// 多币种展示与计算的唯一口径来源。
// 业务口径（见 PRD 文档 MC-*）：
// - 支持人民币 CNY、美元 USD、日元 JPY 三种货币；
// - 整桌统一一种币种，由门店/桌台决定，顾客不可切换，不做跨币种换算；
// - 门店以本币定价，所有金额按该币种直接展示与加总；
// - 小程序金额精度按币种最小单位：CNY/USD 保留 2 位小数，JPY 保留 0 位小数（ISO 4217 最小货币单位）。

export type CurrencyCode = 'CNY' | 'USD' | 'JPY'

export interface CurrencyMeta {
  code: CurrencyCode
  /** 货币符号，位于金额之前 */
  symbol: string
  /** ISO 4217 数字代码，用于辅助说明 */
  numeric: string
  /** 金额展示的小数位（ISO 4217 最小货币单位） */
  fractionDigits: number
  labelKey: string
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  CNY: { code: 'CNY', symbol: '¥', numeric: '156', fractionDigits: 2, labelKey: 'currency.CNY' },
  USD: { code: 'USD', symbol: '$', numeric: '840', fractionDigits: 2, labelKey: 'currency.USD' },
  JPY: { code: 'JPY', symbol: '¥', numeric: '392', fractionDigits: 0, labelKey: 'currency.JPY' },
}

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && (CURRENCY_CODES as string[]).includes(value)

const factorOf = (currency: CurrencyCode) => 10 ** CURRENCIES[currency].fractionDigits

/** 按币种最小单位四舍五入，避免浮点尾数（如 0.1 + 0.2）与超出币种精度的小数。 */
export function roundMoney(value: number, currency: CurrencyCode): number {
  const factor = factorOf(currency)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** 统一金额格式化：符号 + 千分位 + 币种精度，如 ¥1,234.00、$88.50、¥68。 */
export function formatMoney(value: number, currency: CurrencyCode): string {
  const { symbol, fractionDigits } = CURRENCIES[currency]
  const fixed = roundMoney(value, currency).toFixed(fractionDigits)
  const [integer, fraction] = fixed.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${symbol}${fraction ? `${grouped}.${fraction}` : grouped}`
}

/** 折扣前的菜品小计：逐行按币种精度四舍五入后累加，保证明细行与合计一致。 */
export const sumLineTotals = <T extends { price: number; quantity: number }>(
  items: T[],
  currency: CurrencyCode,
): number => roundMoney(items.reduce((sum, item) => sum + roundMoney(item.price * item.quantity, currency), 0), currency)

/** 门店满额减活动：门槛与面额为门店本币金额，不跨币种换算。 */
export const DISCOUNT_THRESHOLD = 100
export const DISCOUNT_AMOUNT = 30

/** 按当前门店币种计算优惠：小计未达门槛时为 0，且优惠不超过小计。 */
export function calcDiscount(subtotal: number, currency: CurrencyCode): number {
  if (subtotal < DISCOUNT_THRESHOLD) return 0
  return Math.min(DISCOUNT_AMOUNT, roundMoney(subtotal, currency))
}

export function calcPayable(subtotal: number, currency: CurrencyCode): number {
  return roundMoney(subtotal - calcDiscount(subtotal, currency), currency)
}

/** 金额的可读辅助文本：JPY 与 CNY 同为 ¥，用 ISO 代码消除歧义（aria-label 等场景）。 */
export function describeMoney(value: number, currency: CurrencyCode): string {
  return `${currency} ${formatMoney(value, currency)}`
}
