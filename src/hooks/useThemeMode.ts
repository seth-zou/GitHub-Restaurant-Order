import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'theme-mode'

/**
 * 夜间模式状态管理 hook。
 * 优先级：用户选择 > 系统偏好 > 浅色。
 * localStorage 不可用时降级为内存态，不报错不阻塞。
 */
export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const initial = getInitialThemeMode()
    applyThemeMode(initial)
    return initial
  })

  useEffect(() => {
    applyThemeMode(mode)
  }, [mode])

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // localStorage 不可用时降级为内存态，不报错
      }
      return next
    })
  }, [])

  return { mode, toggle }
}

function getInitialThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark') return 'dark'
    if (stored === 'light') return 'light'
  } catch {
    // localStorage 不可用时降级为系统偏好
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
  root.dataset.themeMode = mode
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#12100d' : '#fbf5ea')
}
