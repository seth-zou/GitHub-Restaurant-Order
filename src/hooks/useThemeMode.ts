import { useCallback, useSyncExternalStore } from 'react'

/** 用户偏好：system 表示跟随系统，light/dark 表示显式选择。 */
export type ThemePreference = 'system' | 'light' | 'dark'
/** 当前实际生效的界面模式。 */
export type ResolvedTheme = 'light' | 'dark'

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
  /** 系统当前偏好，用于「跟随系统」选项的说明文案。 */
  system: ResolvedTheme
}

const STORAGE_KEY = 'theme-mode'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#fbf5ea', dark: '#12100d' }

/** localStorage 不可用时保存本次页面会话的选择，跨路由组件重挂载后仍然生效。 */
let fallbackPreference: ThemePreference | null = null
const listeners = new Set<() => void>()
let mediaQueryList: MediaQueryList | null = null

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** 读取用户偏好；非法值按「没有保存过」处理，交给默认策略推断。 */
function readStoredPreference(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemePreference(stored) ? stored : null
  } catch {
    return null
  }
}

/** 读取系统偏好；能力不可用或读取异常时回退白天模式。 */
function detectSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function buildState(preference: ThemePreference, system: ResolvedTheme): ThemeState {
  return { preference, resolved: preference === 'system' ? system : preference, system }
}

function applyState(state: ThemeState) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', state.resolved === 'dark')
  root.dataset.themeMode = state.resolved
  root.dataset.themePreference = state.preference
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[state.resolved])
}

let systemTheme = detectSystemTheme()
let currentState = buildState(fallbackPreference ?? readStoredPreference() ?? 'system', systemTheme)

function publish(next: ThemeState) {
  currentState = next
  applyState(next)
  listeners.forEach((listener) => listener())
}

/** 仅当偏好为「跟随系统」时，系统偏好的运行时变化才影响界面。 */
function handleSystemChange() {
  const nextSystem = detectSystemTheme()
  if (nextSystem === systemTheme) return
  systemTheme = nextSystem
  publish(buildState(currentState.preference, systemTheme))
}

function ensureMediaListener() {
  if (mediaQueryList || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  try {
    mediaQueryList = window.matchMedia(DARK_QUERY)
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleSystemChange)
    } else {
      mediaQueryList.addListener(handleSystemChange)
    }
  } catch {
    mediaQueryList = null
  }
}

/** 写入用户偏好；存储不可用时降级为会话内存态，不报错、不阻塞业务。 */
export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
    fallbackPreference = null
  } catch {
    fallbackPreference = preference
  }
  publish(buildState(preference, systemTheme))
}

function subscribe(listener: () => void) {
  ensureMediaListener()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ThemeState {
  return currentState
}

// 模块加载时同步一次 DOM，覆盖 index.html 内联脚本与运行时状态不一致的情况（如旧版非法值）。
if (typeof document !== 'undefined') applyState(currentState)

/**
 * 主题状态管理 hook。
 * 优先级：用户显式选择 > 系统偏好 > 白天模式；偏好为 system 时实时跟随系统变化。
 * 多个入口共享同一份模块级状态，避免同一页面内图标与实际界面不一致。
 */
export function useThemeMode() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), [])
  return { ...state, setPreference }
}
