import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyThemeState,
  buildThemeState,
  createThemeStore,
  detectSystemTheme,
  isThemePreference,
  readStoredPreference,
  resolveInitialPreference,
  resolveTheme,
  THEME_COLOR,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  watchSystemTheme,
  writeStoredPreference,
  type ThemeDocumentLike,
  type ThemeMediaMatcher,
  type ThemeStorage,
} from '../src/lib/theme.ts'

/** 内存版 localStorage，可注入初始值。 */
function createStorage(initial: Record<string, string> = {}): ThemeStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

/** 模拟隐私模式下读写均抛出 SecurityError 的存储。 */
function createThrowingStorage(): ThemeStorage {
  return {
    getItem: () => {
      throw new Error('storage read blocked')
    },
    setItem: () => {
      throw new Error('storage write blocked')
    },
  }
}

/** 最小 document 替身，用于验证 html / meta 同步。 */
function createDocument(options: { withMeta?: boolean } = {}) {
  const withMeta = options.withMeta ?? true
  const classes = new Set<string>()
  const dataset: Record<string, string | undefined> = {}
  const meta = { content: 'unset' }
  const doc: ThemeDocumentLike = {
    documentElement: {
      classList: {
        toggle: (token, force) => {
          if (force) classes.add(token)
          else classes.delete(token)
        },
      },
      dataset,
    },
    querySelector: (selector) => {
      if (!withMeta || selector !== 'meta[name="theme-color"]') return null
      return {
        setAttribute: (name, value) => {
          if (name === 'content') meta.content = value
        },
      }
    },
  }
  return { doc, classes, dataset, meta }
}

function createMatcher(matches: boolean, throws = false): { matcher: ThemeMediaMatcher; queries: string[] } {
  const queries: string[] = []
  return {
    queries,
    matcher: (query) => {
      queries.push(query)
      if (throws) throw new Error('matchMedia blocked')
      return { matches }
    },
  }
}

describe('偏好校验与解析（REQ-101）', () => {
  it('只接受 system / light / dark，其余按非法值处理', () => {
    for (const value of ['system', 'light', 'dark']) {
      assert.equal(isThemePreference(value), true)
    }
    for (const value of [null, undefined, '', 'auto', 'DARK', 'darkish', 'true']) {
      assert.equal(isThemePreference(value), false)
    }
  })

  it('system 跟随系统偏好，显式偏好覆盖系统偏好', () => {
    assert.equal(resolveTheme('system', 'dark'), 'dark')
    assert.equal(resolveTheme('system', 'light'), 'light')
    assert.equal(resolveTheme('light', 'dark'), 'light')
    assert.equal(resolveTheme('dark', 'light'), 'dark')
  })

  it('buildThemeState 同时保留用户偏好、生效模式与系统偏好', () => {
    assert.deepEqual(buildThemeState('system', 'dark'), { preference: 'system', resolved: 'dark', system: 'dark' })
    assert.deepEqual(buildThemeState('light', 'dark'), { preference: 'light', resolved: 'light', system: 'dark' })
  })
})

describe('本机偏好读写（REQ-101 / REQ-106）', () => {
  it('读取合法保存值，历史 light / dark 继续有效', () => {
    assert.equal(readStoredPreference(createStorage({ [THEME_STORAGE_KEY]: 'system' })), 'system')
    assert.equal(readStoredPreference(createStorage({ [THEME_STORAGE_KEY]: 'light' })), 'light')
    assert.equal(readStoredPreference(createStorage({ [THEME_STORAGE_KEY]: 'dark' })), 'dark')
  })

  it('无保存值、非法值或存储不可用时按未保存处理', () => {
    assert.equal(readStoredPreference(createStorage()), null)
    assert.equal(readStoredPreference(createStorage({ [THEME_STORAGE_KEY]: 'not-a-mode' })), null)
    assert.equal(readStoredPreference(createThrowingStorage()), null)
    assert.equal(readStoredPreference(null), null)
  })

  it('写入成功返回 true 并落盘', () => {
    const storage = createStorage()
    assert.equal(writeStoredPreference(storage, 'dark'), true)
    assert.equal(storage.data.get(THEME_STORAGE_KEY), 'dark')
  })

  it('写入抛错返回 false 且不向外抛错', () => {
    assert.equal(writeStoredPreference(createThrowingStorage(), 'dark'), false)
    assert.equal(writeStoredPreference(null, 'dark'), false)
  })

  it('初始偏好优先级：保存值 > 默认跟随系统', () => {
    assert.equal(resolveInitialPreference(createStorage({ [THEME_STORAGE_KEY]: 'light' })), 'light')
    assert.equal(resolveInitialPreference(createStorage({ [THEME_STORAGE_KEY]: 'dark' })), 'dark')
    assert.equal(resolveInitialPreference(createStorage({ [THEME_STORAGE_KEY]: 'oops' })), 'system')
    assert.equal(resolveInitialPreference(createStorage()), 'system')
    assert.equal(resolveInitialPreference(null), 'system')
  })
})

describe('系统偏好检测（REQ-101 / REQ-102 / REQ-106）', () => {
  it('匹配 dark 查询时返回夜间模式，并使用标准查询串', () => {
    const { matcher, queries } = createMatcher(true)
    assert.equal(detectSystemTheme(matcher), 'dark')
    assert.deepEqual(queries, [THEME_MEDIA_QUERY])
  })

  it('不匹配或未声明偏好时返回白天模式', () => {
    assert.equal(detectSystemTheme(createMatcher(false).matcher), 'light')
  })

  it('matchMedia 不可用或抛错时回退白天模式且不抛错', () => {
    assert.equal(detectSystemTheme(null), 'light')
    assert.equal(detectSystemTheme(createMatcher(false, true).matcher), 'light')
  })
})

describe('系统偏好监听注册（REQ-102.4 / REQ-102.5）', () => {
  it('优先使用 addEventListener 注册 change 监听', () => {
    const events: string[] = []
    let legacyCalls = 0
    let listenerCalls = 0
    const media = {
      matches: false,
      addEventListener: (type: string, listener: () => void) => {
        events.push(type)
        listener()
      },
      addListener: () => {
        legacyCalls += 1
      },
    }

    assert.equal(watchSystemTheme(media, () => { listenerCalls += 1 }), true)
    assert.deepEqual(events, ['change'])
    assert.equal(legacyCalls, 0)
    assert.equal(listenerCalls, 1)
  })

  it('仅提供旧版 addListener 时仍能接收系统偏好变化', () => {
    const legacy: Array<() => void> = []
    let listenerCalls = 0
    const media = {
      matches: true,
      addListener: (listener: () => void) => {
        legacy.push(listener)
      },
    }

    assert.equal(watchSystemTheme(media, () => { listenerCalls += 1 }), true)
    assert.equal(legacy.length, 1)
    legacy[0]!()
    assert.equal(listenerCalls, 1)
  })

  it('两种监听能力都缺失时返回 false，由调用方降级', () => {
    assert.equal(watchSystemTheme({ matches: false }, () => {}), false)
  })
})

describe('DOM 同步（REQ-101 / REQ-104）', () => {
  it('夜间模式切换 html.dark，并写入 data-theme-* 与 theme-color', () => {
    const { doc, classes, dataset, meta } = createDocument()
    applyThemeState(doc, buildThemeState('dark', 'light'))
    assert.equal(classes.has('dark'), true)
    assert.equal(dataset.themeMode, 'dark')
    assert.equal(dataset.themePreference, 'dark')
    assert.equal(meta.content, THEME_COLOR.dark)
  })

  it('跟随系统且系统为夜间时，偏好保持 system 而生效模式为 dark', () => {
    const { doc, classes, dataset, meta } = createDocument()
    applyThemeState(doc, buildThemeState('system', 'dark'))
    assert.equal(classes.has('dark'), true)
    assert.equal(dataset.themeMode, 'dark')
    assert.equal(dataset.themePreference, 'system')
    assert.equal(meta.content, THEME_COLOR.dark)
  })

  it('白天模式移除 html.dark 并恢复浅色 theme-color', () => {
    const { doc, classes, dataset, meta } = createDocument()
    classes.add('dark')
    applyThemeState(doc, buildThemeState('light', 'dark'))
    assert.equal(classes.has('dark'), false)
    assert.equal(dataset.themeMode, 'light')
    assert.equal(dataset.themePreference, 'light')
    assert.equal(meta.content, THEME_COLOR.light)
  })

  it('document 或 theme-color meta 缺失时安全跳过', () => {
    assert.doesNotThrow(() => applyThemeState(null, buildThemeState('dark', 'light')))
    const { doc, dataset } = createDocument({ withMeta: false })
    assert.doesNotThrow(() => applyThemeState(doc, buildThemeState('dark', 'light')))
    assert.equal(dataset.themeMode, 'dark')
  })
})

describe('主题状态机（REQ-102 / REQ-103 / REQ-107）', () => {
  it('初始化时应用一次状态，快照包含偏好与生效模式', () => {
    const applied: string[] = []
    const store = createThemeStore({
      preference: 'system',
      system: 'dark',
      apply: (state) => applied.push(`${state.preference}:${state.resolved}`),
    })
    assert.deepEqual(applied, ['system:dark'])
    assert.deepEqual(store.getSnapshot(), { preference: 'system', resolved: 'dark', system: 'dark' })
  })

  it('setPreference 立即生效并通知订阅者', () => {
    const applied: string[] = []
    const store = createThemeStore({ preference: 'system', system: 'light', apply: (state) => applied.push(state.resolved) })
    let notified = 0
    const unsubscribe = store.subscribe(() => {
      notified += 1
    })

    store.setPreference('dark')
    assert.equal(store.getSnapshot().resolved, 'dark')
    assert.equal(store.getSnapshot().preference, 'dark')
    assert.equal(notified, 1)
    assert.deepEqual(applied, ['light', 'dark'])
    unsubscribe()
  })

  it('system 偏好下系统变化即时联动', () => {
    const store = createThemeStore({ preference: 'system', system: 'light' })
    store.setSystemTheme('dark')
    assert.deepEqual(store.getSnapshot(), { preference: 'system', resolved: 'dark', system: 'dark' })
  })

  it('显式偏好下系统变化只更新系统提示，不改变生效模式', () => {
    const store = createThemeStore({ preference: 'light', system: 'light' })
    let notified = 0
    store.subscribe(() => {
      notified += 1
    })

    store.setSystemTheme('dark')
    assert.deepEqual(store.getSnapshot(), { preference: 'light', resolved: 'light', system: 'dark' })
    assert.equal(notified, 1)
  })

  it('系统偏好未变化时不重复通知', () => {
    const store = createThemeStore({ preference: 'system', system: 'dark' })
    let notified = 0
    store.subscribe(() => {
      notified += 1
    })
    store.setSystemTheme('dark')
    assert.equal(notified, 0)
  })

  it('取消订阅后不再收到通知', () => {
    const store = createThemeStore({ preference: 'system', system: 'light' })
    let notified = 0
    const unsubscribe = store.subscribe(() => {
      notified += 1
    })
    unsubscribe()
    store.setPreference('dark')
    assert.equal(notified, 0)
  })

  it('快照对象仅在状态变化时替换，满足 useSyncExternalStore 稳定性要求', () => {
    const store = createThemeStore({ preference: 'system', system: 'light' })
    const first = store.getSnapshot()
    assert.equal(store.getSnapshot(), first)
    store.setPreference('dark')
    assert.notEqual(store.getSnapshot(), first)
  })
})

describe('契约一致性（index.html / localStorage）', () => {
  it('存储 key 与两套模式的 theme-color 与内联脚本约定一致', () => {
    assert.equal(THEME_STORAGE_KEY, 'theme-mode')
    assert.equal(THEME_COLOR.light, '#fbf5ea')
    assert.equal(THEME_COLOR.dark, '#12100d')
  })
})
