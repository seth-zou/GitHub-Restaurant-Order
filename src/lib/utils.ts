import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// crypto.randomUUID 仅在安全上下文（https / localhost）可用；
// 通过局域网 IP 或 file:// 打开时它是 undefined，直接调用会抛错。
// 演示为纯前端应用，需在任意来源下都能生成唯一 id，故降级为 Math.random 方案。
export function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // 忽略：不可用时走下方降级分支
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// 金额格式化已迁移到 `@/lib/currency`（需显式传入币种，避免遗漏币种导致串币）。
// 保留 `money` 兼容别名，默认人民币；新代码请使用 `formatMoney(value, currency)`。
export { formatMoney, roundMoney, sumLineTotals, calcDiscount, calcPayable, describeMoney } from '@/lib/currency'
import { formatMoney } from '@/lib/currency'
import type { CurrencyCode } from '@/lib/currency'

export const money = (value: number, currency: CurrencyCode = 'CNY') => formatMoney(value, currency)
