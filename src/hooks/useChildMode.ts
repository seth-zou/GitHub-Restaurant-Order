import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'child-mode'
const SESSION_KEY = 'child-mode-fallback'

/** localStorage 不可用时的会话级 fallback，跨路由组件重挂载保持本次用户选择。 */
let fallbackChildMode: boolean | null = null

/**
 * 儿童模式状态管理 hook。
 * 与老人模式（html.elderly）、夜间模式（html.dark）相互独立、可叠加。
 * 优先级：localStorage > 默认关闭。
 * localStorage 不可用时降级为内存态，不报错不阻塞。
 */
export function useChildMode() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const initial = getInitialChildMode()
    applyChildMode(initial)
    return initial
  })

  useEffect(() => {
    applyChildMode(enabled)
  }, [enabled])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false')
        fallbackChildMode = null
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
      } catch {
        // 写入失败：旧存储值已不可靠，保留会话级 fallback
        fallbackChildMode = next
        try { sessionStorage.setItem(SESSION_KEY, next ? 'true' : 'false') } catch { /* ignore */ }
      }
      return next
    })
  }, [])

  return { enabled, toggle }
}

function getInitialChildMode(): boolean {
  // 写入失败后旧存储值不可靠，会话 fallback 必须优先。
  if (fallbackChildMode !== null) return fallbackChildMode
  // 页面重载后模块级 fallback 丢失，尝试从 sessionStorage 恢复（localStorage 不可用场景）
  try {
    const session = sessionStorage.getItem(SESSION_KEY)
    if (session === 'true') return true
    if (session === 'false') return false
  } catch {
    // sessionStorage 也不可用
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    // localStorage 不可用时降级为默认关闭
  }
  return false
}

function applyChildMode(enabled: boolean) {
  const root = document.documentElement
  root.classList.toggle('child', enabled)
  root.dataset.childMode = enabled ? 'on' : 'off'
}

/** 儿童模式下默认隐藏的菜品：锅底辣度包含“超级辣”的菜品。 */
export function isSpicyForChildren(product: { options?: { spicy?: string[] } }): boolean {
  return !!product.options?.spicy?.includes('menu.option.super_spicy')
}
