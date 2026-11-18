/**
 * 主题核心逻辑：偏好解析、系统偏好检测、存储读写、DOM 同步与状态机。
 * 该模块不依赖 React 与浏览器全局对象，便于在单元测试中注入假实现；
 * 浏览器环境下的装配见 `src/hooks/useThemeMode.ts`。
 */

/** 用户偏好：system 表示跟随系统，light/dark 表示显式选择。 */
export type ThemePreference = 'system' | 'light' | 'dark'
/** 当前实际生效的界面模式。 */
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
  /** 系统当前偏好，用于「跟随系统」选项的说明文案。 */
  system: ResolvedTheme
}

export const THEME_STORAGE_KEY = 'theme-mode'
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'
/** 与 index.html 内联脚本中的 theme-color 保持一致。 */
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#fbf5ea', dark: '#12100d' }

/** 校验存储值是否为合法偏好；历史版本只写入 light/dark，同样合法。 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** 偏好为 system 时按系统偏好解析，否则以显式选择为准。 */
export function resolveTheme(preference: ThemePreference, system: ResolvedTheme): ResolvedTheme {
  return preference === 'system' ? system : preference
}

export function buildThemeState(preference: ThemePreference, system: ResolvedTheme): ThemeState {
  return { preference, resolved: resolveTheme(preference, system), system }
}

/** localStorage 的最小接口，便于测试注入失败实现。 */
export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 读取用户偏好；非法值按「没有保存过」处理，交给默认策略推断。 */
export function readStoredPreference(storage: ThemeStorage | null): ThemePreference | null {
  if (!storage) return null
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : null
  } catch {
    return null
  }
}

/** 写入偏好，返回是否成功持久化；失败时由调用方的内存态兜底，不影响当前会话。 */
export function writeStoredPreference(storage: ThemeStorage | null, preference: ThemePreference): boolean {
  if (!storage) return false
  try {
    storage.setItem(THEME_STORAGE_KEY, preference)
    return true
  } catch {
    return false
  }
}

/** 初始偏好优先级：本机保存值 > system（默认跟随系统）。 */
export function resolveInitialPreference(storage: ThemeStorage | null): ThemePreference {
  return readStoredPreference(storage) ?? 'system'
}

/** matchMedia 返回值的最小接口，兼容旧版 addListener。 */
export interface ThemeMediaQuery {
  matches: boolean
  addEventListener?: (type: 'change', listener: () => void) => void
  addListener?: (listener: () => void) => void
}

export type ThemeMediaMatcher = (query: string) => ThemeMediaQuery

/**
 * 注册系统偏好变化监听：优先 addEventListener，旧版 Safari 回退 addListener。
 * 返回是否注册成功；两种能力都缺失时由调用方按「不跟随系统变化」降级。
 */
export function watchSystemTheme(media: ThemeMediaQuery, listener: () => void): boolean {
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener)
    return true
  }
  if (typeof media.addListener === 'function') {
    media.addListener(listener)
    return true
  }
  return false
}

/** 读取系统偏好；能力不可用或读取异常时回退白天模式。 */
export function detectSystemTheme(matchMedia: ThemeMediaMatcher | null): ResolvedTheme {
  if (!matchMedia) return 'light'
  try {
    return matchMedia(THEME_MEDIA_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** document 的最小接口，避免单元测试依赖真实 DOM。 */
export interface ThemeDocumentLike {
  documentElement: {
    classList: { toggle(token: string, force?: boolean): void }
    dataset: { themeMode?: string; themePreference?: string }
  }
  querySelector(selector: string): { setAttribute(name: string, value: string): void } | null
}

/** 同步 html.dark、data-theme-mode、data-theme-preference 与 theme-color。 */
export function applyThemeState(doc: ThemeDocumentLike | null, state: ThemeState): void {
  if (!doc) return
  const root = doc.documentElement
  root.classList.toggle('dark', state.resolved === 'dark')
  root.dataset.themeMode = state.resolved
  root.dataset.themePreference = state.preference
  const meta = doc.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[state.resolved])
}

export interface ThemeStoreOptions {
  /** 初始用户偏好，通常由 resolveInitialPreference 得出。 */
  preference: ThemePreference
  /** 初始系统偏好。 */
  system: ResolvedTheme
  /** 状态变化时同步 DOM 等副作用。 */
  apply?: (state: ThemeState) => void
}

export interface ThemeStore {
  getSnapshot(): ThemeState
  subscribe(listener: () => void): () => void
  /** 应用用户显式选择或「跟随系统」偏好。 */
  setPreference(preference: ThemePreference): void
  /** 系统偏好运行时变化；仅 system 偏好会改变生效模式。 */
  setSystemTheme(system: ResolvedTheme): void
}

/**
 * 主题状态机：多个入口共享同一实例，保证图标与实际界面一致。
 * 状态对象只在变化时替换，满足 useSyncExternalStore 的快照稳定性要求。
 */
export function createThemeStore({ preference, system, apply }: ThemeStoreOptions): ThemeStore {
  let currentSystem = system
  let state = buildThemeState(preference, currentSystem)
  const listeners = new Set<() => void>()

  const publish = (next: ThemeState) => {
    state = next
    apply?.(next)
    listeners.forEach((listener) => listener())
  }

  apply?.(state)

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setPreference(next) {
      publish(buildThemeState(next, currentSystem))
    },
    setSystemTheme(next) {
      if (next === currentSystem) return
      currentSystem = next
      publish(buildThemeState(state.preference, currentSystem))
    },
  }
}
