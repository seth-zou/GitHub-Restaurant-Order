// 多币种展示与加算的唯一口径来源。
// 业务口径（见 PRD 文档）：
// - 整桌统一一种币种，由门店/桌台决定，顾客不可改；
// - 所有币种统一保留 2 位小数；
// - 门店优惠活动随币种展示同面额金额（¥30 → $30 / HK$30 / ¥30 JPY 口径见 ACTIVITY_AMOUNTS）。

export type CurrencyCode = 'CNY' | 'USD' | 'HKD' | 'JPY'

export interface CurrencyMeta {
  code: CurrencyCode
  /** 货币符号，位于金额之前 */
  symbol: string
  /** ISO 4217 数字代码，用于 aria-label / 辅助说明 */
  numeric: string
  labelKey: string
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  CNY: { code: 'CNY', symbol: '¥', numeric: '156', labelKey: 'currency.CNY' },
  USD: { code: 'USD', symbol: '$', numeric: '840', labelKey: 'currency.USD' },
  HKD: { code: 'HKD', symbol: 'HK$', numeric: '344', labelKey: 'currency.HKD' },
  JPY: { code: 'JPY', symbol: '¥', numeric: '392', labelKey: 'currency.JPY' },
}

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && (CURRENCY_CODES as string[]).includes(value)

/** 金额统一保留 2 位小数；对浮点误差做一次四舍五入，避免 0.1 + 0.2 类尾数。 */
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

/** 统一金额格式化：符号 + 千分位 + 2 位小数，如 $1,234.00、HK$88.50、¥68.00。 */
export function formatMoney(value: number, currency: CurrencyCode): string {
  const { symbol } = CURRENCIES[currency]
  return `${symbol}${roundMoney(value).toFixed(2)}`
}

/** 折扣前的菜品小计，按条目逐项四舍五入后累加，保证明细行与小计一致。 */
export const sumLineTotals = <T extends { price: number; quantity: number }>(items: T[]): number =>
  roundMoney(items.reduce((sum, item) => sum + roundMoney(item.price) * item.quantity, 0))

/** 满额减优惠：门槛与面额使用门店活动所在币种的面额（同数字面额，只换币种）。 */
export const DISCOUNT_THRESHOLD = 100
export const DISCOUNT_AMOUNT = 30

/** 按当前币种计算优惠：小计未达门槛时为 0，且优惠不会超过小计。 */
export function calcDiscount(subtotal: number): number {
  if (subtotal < DISCOUNT_THRESHOLD) return 0
  return Math.min(DISCOUNT_AMOUNT, roundMoney(subtotal))
}

export function calcPayable(subtotal: number): number {
  return roundMoney(subtotal - calcDiscount(subtotal))
}

/** 金额的可读辅助文本，用于 aria-label 等需要消除 ¥/$ 歧义的场景。 */
export function describeMoney(value: number, currency: CurrencyCode): string {
  return `${currency} ${formatMoney(value, currency)}`
}
