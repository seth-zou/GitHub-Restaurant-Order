import { useTranslation } from 'react-i18next'
import { Check, Soup } from 'lucide-react'
import { getProduct } from '@/data/menu'
import { basesTotal, describeBases } from '@/lib/hotpot'
import { money } from '@/lib/utils'
import type { HotpotBaseSelection } from '@/types'

interface HotpotBaseSummaryProps {
  bases: HotpotBaseSelection[]
  /** 可编辑时展示“更换/选择底料”入口 */
  onChange?: () => void
  /** 未选择时展示阻断提示（选中性引导 + 必需标识） */
  warning?: boolean
}

/** 底料汇总：购物车、订单详情、结账共用的只读展示，保证信息一致。 */
export function HotpotBaseSummary({ bases, onChange, warning }: HotpotBaseSummaryProps) {
  const { t } = useTranslation()
  const base = { 'data-testid': 'hotpot-base-summary' }

  if (!bases.length) {
    return (
      <section {...base} className={`rounded-2xl border p-4 ${warning ? 'border-amber-400/60 bg-amber-100/70' : 'border-charcoal-900/5 bg-rice-100'}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-chili-500"><Soup size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-charcoal-900">
              {t('hotpot_base.entry_title')}
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-charcoal-900">{t('hotpot_base.required_badge')}</span>
            </p>
            <p className="mt-1 text-sm text-charcoal-700">{warning ? t('hotpot_base.required_to_submit') : t('hotpot_base.not_selected')}</p>
            {warning && <p className="mt-1 text-xs leading-5 text-charcoal-500">{t('hotpot_base.cart_empty_hint')}</p>}
          </div>
          {onChange && <button onClick={onChange} className="shrink-0 rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-xs font-bold text-charcoal-900 hover:border-chili-500/30">{t('hotpot_base.entry_select')}</button>}
        </div>
      </section>
    )
  }

  return (
    <section {...base} className="rounded-2xl border border-chili-500/20 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-charcoal-900">{t('hotpot_base.entry_title')}<span className="flex items-center gap-1 rounded-full bg-chili-50 px-2 py-0.5 text-xs font-bold text-chili-600"><Check size={12} />{t('hotpot_base.required_badge')}</span></p>
          <p className="mt-1 break-words text-sm font-semibold text-charcoal-700">{describeBases(bases, t)}</p>
          {bases.map((base) => {
            const product = getProduct(base.productId)
            // 规格（口味/辣度/风险确认）与底料名称分开同行展示，便于用户核对
            const spec = product ? base.spec.replace(t(product.name), '').replace(/^ · |^\s*·\s*/g, '').trim() : ''
            return spec ? <p key={base.productId} className="mt-0.5 break-words text-xs text-charcoal-500">{spec}</p> : null
          })}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-extrabold text-chili-500">{money(basesTotal(bases))}</p>
          {onChange && <button onClick={onChange} className="mt-1 text-xs font-bold text-charcoal-500 hover:text-chili-500">{t('hotpot_base.entry_change')}</button>}
        </div>
      </div>
    </section>
  )
}
