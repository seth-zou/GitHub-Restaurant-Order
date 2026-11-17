import { useCallback, useSyncExternalStore } from 'react'
import {
  applyThemeState,
  createThemeStore,
  detectSystemTheme,
  resolveInitialPreference,
  THEME_MEDIA_QUERY,
  watchSystemTheme,
  writeStoredPreference,
  type ThemeMediaMatcher,
  type ThemeMediaQuery,
  type ThemePreference,
  type ThemeState,
  type ThemeStorage,
} from '@/lib/theme'

export type { ResolvedTheme, ThemePreference } from '@/lib/theme'

/** 系统偏好监听只注册一次；模块级 store 保证跨路由重挂载共享同一份状态。 */
let mediaQuery: ThemeMediaQuery | null = null

/** 读取 localStorage；隐私模式等场景下访问可能抛错，统一降级为 null。 */
function getStorage(): ThemeStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** 包装 matchMedia；能力不可用时返回 null，由 detectSystemTheme 回退白天模式。 */
function getMatchMedia(): ThemeMediaMatcher | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return (query) => window.matchMedia(query)
}

function applyToDocument(state: ThemeState) {
  applyThemeState(typeof document === 'undefined' ? null : document, state)
}

const store = createThemeStore({
  preference: resolveInitialPreference(getStorage()),
  system: detectSystemTheme(getMatchMedia()),
  apply: applyToDocument,
})

/** 系统偏好变化时重新检测；是否影响生效模式由 store 中的用户偏好决定。 */
function handleSystemChange() {
  store.setSystemTheme(detectSystemTheme(getMatchMedia()))
}

/** 注册系统偏好监听，优先 addEventListener，旧版浏览器回退 addListener。 */
function ensureMediaListener() {
  if (mediaQuery || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  try {
    const list = window.matchMedia(THEME_MEDIA_QUERY)
    if (!watchSystemTheme(list, handleSystemChange)) return
    mediaQuery = list
  } catch {
    mediaQuery = null
  }
}

/**
 * 写入用户偏好；存储不可用时降级为会话内存态，不报错、不阻塞业务。
 * 写入失败后由模块级 store 保留本次会话选择，刷新页面才回到默认策略。
 */
export function setThemePreference(preference: ThemePreference) {
  writeStoredPreference(getStorage(), preference)
  store.setPreference(preference)
}

function subscribe(listener: () => void) {
  ensureMediaListener()
  return store.subscribe(listener)
}

/**
 * 主题状态管理 hook。
 * 优先级：用户显式选择 > 系统偏好 > 白天模式；偏好为 system 时实时跟随系统变化。
 * 多个入口共享同一份模块级状态，避免同一页面内图标与实际界面不一致。
 */
export function useThemeMode() {
  const state = useSyncExternalStore(subscribe, store.getSnapshot, store.getSnapshot)
  const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), [])
  return { ...state, setPreference }
}
