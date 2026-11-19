import i18next from 'i18next'
import { MAX_HOTPOT_BASES, getProduct, hotpotBases } from '@/data/menu'
import { money } from '@/lib/utils'
import type { HotpotBaseSelection, Product } from '@/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const translate: Translate = (key, options) => String(i18next.t(key, options))

export { hotpotBases, MAX_HOTPOT_BASES }

/** 底料是否可售：复用菜单的商品售罄状态。 */
const isAvailable = (product: Product, soldOut: string[]) => !soldOut.includes(product.id)

/** 有可售底料时才要求选择；全部售罄时视为不阻塞，避免用户无法点餐。 */
export const hasSelectableBases = (soldOut: string[]) => hotpotBases.some((product) => isAvailable(product, soldOut))

/** 已选底料是否仍然满足“至少 1 种、至多 2 种且均可售”。 */
export const isBaseSelectionValid = (bases: HotpotBaseSelection[], soldOut: string[]) => {
  if (bases.length < 1 || bases.length > MAX_HOTPOT_BASES) return false
  return bases.every((base) => {
    const product = getProduct(base.productId)
    return !!product?.isHotpotBase && isAvailable(product, soldOut)
  })
}

/** 生成购物车/订单展示文案：若为双拼则追加“双拼”标识，价格取所选底料正价合计。 */
export const describeBases = (bases: HotpotBaseSelection[], t: Translate = translate) => {
  if (!bases.length) return ''
  return bases.map((base) => {
    const product = getProduct(base.productId)
    return t(product?.name || base.productId)
  }).join(' + ') + (bases.length > 1 ? ` · ${t('hotpot_base.combo')}` : '')
}

export const basesTotal = (bases: HotpotBaseSelection[]) => bases.reduce((sum, base) => sum + (getProduct(base.productId)?.price || 0), 0)

export const basesSummary = (bases: HotpotBaseSelection[], t: Translate = translate) => `${describeBases(bases, t)} · ${money(basesTotal(bases))}`
