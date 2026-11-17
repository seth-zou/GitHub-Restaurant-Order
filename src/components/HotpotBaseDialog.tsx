import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HotpotBaseSelection as HotpotBase } from '@/types'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, Soup } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { MAX_HOTPOT_BASES, hotpotBases } from '@/lib/hotpot'
import { money } from '@/lib/utils'
import type { HotpotBaseSelection } from '@/types'

interface HotpotBaseDialogProps {
  open: boolean
  /** 从菜单规格进入时的携带规格，选中对应底料时优先使用 */
  preset?: HotpotBaseSelection | null
  value: HotpotBaseSelection[]
  soldOut: string[]
  /** 首次必选：未确认前不允许关闭（遮罩点击、Esc、关闭按钮都被拦截） */
  required?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (bases: HotpotBaseSelection[]) => void
}

/** 底料选择弹窗：单选=单锅，多选（最多 2 种）=双拼；售罄底料置灰不可选。 */
export function HotpotBaseDialog({ open, preset, value, soldOut, required, onOpenChange, onConfirm }: HotpotBaseDialogProps) {
  const { t } = useTranslation()
  const [, setDraftState] = useState<HotpotBaseSelection[]>([])
  // 草稿的唯一真实来源：避免 StrictMode 下 setState 批处理与渲染时序导致计数与选中不一致
  const draftRef = useRef<HotpotBaseSelection[]>([])
  const setDraft = (next: HotpotBaseSelection[] | ((prev: HotpotBaseSelection[]) => HotpotBaseSelection[])) => {
    const resolved = typeof next === 'function' ? next(draftRef.current) : next
    draftRef.current = resolved
    setDraftState(resolved)
  }
  const [invalid, setInvalid] = useState(false)
  const submittedRef = useRef(value)
  // 通过“确认/取消”自身关闭时放行一次，避免必选锁把正常关闭也拦掉（会残留透明遮罩吞点击）
  const allowCloseRef = useRef(false)
  // 记录父级最新值供“打开瞬间”读取，但不作为 effect 依赖，避免编辑中覆盖用户草稿
  const valueRef = useRef(value)
  const presetRef = useRef(preset)
  valueRef.current = value
  presetRef.current = preset

  // 仅在“打开”这一刻用当前已确认选择初始化草稿；value 在编辑过程中变化不应覆盖用户的临时勾选
  useEffect(() => {
    if (open) {
      const currentValue: HotpotBase[] = valueRef.current
      const currentPreset = presetRef.current
      submittedRef.current = currentValue
      // 从菜单规格进入：预置该底料（携带辣度规格），编辑已有底料则保持原值
      const initial = currentPreset ? [currentPreset] : currentValue
      draftRef.current = initial
      setDraftState(initial)
      setInvalid(false)
    }
  }, [open])

  const available = useMemo(() => hotpotBases.filter((product) => !soldOut.includes(product.id)), [soldOut])
  const noneAvailable = available.length === 0

  const toggle = (productId: string, spec: string) => {
    setInvalid(false)
    const current = draftRef.current
    const exists = current.find((base) => base.productId === productId)
    if (exists) {
      setDraft(current.filter((base) => base.productId !== productId))
      return
    }
    if (current.some((base) => !base.productId)) {
      // 自愈：过滤掉历史空对象，避免出现“计数对但底料缺失”的脏草稿
      setDraft([...current.filter((base) => base.productId), { productId, spec }])
      return
    }
    if (current.length >= MAX_HOTPOT_BASES) {
      // 已选满 2 种时再选：替换后加入的那一项，保持“最后一次选择生效”
      setDraft(current.map((base, index) => (index === 1 ? { productId, spec } : base)))
      return
    }
    setDraft([...current, { productId, spec }])
  }

  const confirm = () => {
    const current = draftRef.current
    if (!current.length) {
      setInvalid(true)
      return
    }
    // 以 ref 中的最新草稿为准，避免 StrictMode 下 state 批次更新读到旧值
    const next = [...current]
    submittedRef.current = next
    onConfirm(next)
    setDraft(next)
    allowCloseRef.current = true
    onOpenChange(false)
  }

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next && required && !allowCloseRef.current) return
    allowCloseRef.current = false
    onOpenChange(next)
  }, [onOpenChange, required])


  const draftTotal = draftRef.current.reduce((sum, base) => sum + (hotpotBases.find((product) => product.id === base.productId)?.price || 0), 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent title={t('hotpot_base.title')} hideClose={required}>
        <p className="mt-2 text-sm leading-6 text-charcoal-500">{required ? t('hotpot_base.desc_required') : t('hotpot_base.desc_edit')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-charcoal-900">{t('hotpot_base.required_badge')}</span>
          <span className="text-xs font-semibold text-charcoal-500">{t('hotpot_base.limit_hint', { max: MAX_HOTPOT_BASES })}</span>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-rice-100 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 font-semibold text-charcoal-700"><Soup size={16} className="text-chili-500" />{t('hotpot_base.selected_count', { count: draftRef.current.length })}</span>
          <span className="font-bold text-charcoal-900">{money(draftTotal)}</span>
        </div>

        {noneAvailable ? (
          <div className="mt-4 rounded-2xl border border-charcoal-900/5 bg-white p-5 text-center">
            <p className="font-bold text-charcoal-900">{t('hotpot_base.none_available_title')}</p>
            <p className="mt-2 text-sm leading-6 text-charcoal-500">{t('hotpot_base.none_available_desc')}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {hotpotBases.map((product) => {
              const unavailable = soldOut.includes(product.id)
              const selected = draftRef.current.some((base) => base.productId === product.id)
              const flavorLabel = product.options?.flavor?.map((key) => t(key)).join(' / ')
              return (
                <div
                  key={product.id}
                  data-selected={selected}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-chili-500 bg-chili-50' : 'border-charcoal-900/5 bg-white'} ${unavailable ? 'opacity-50' : ''}`}
                >
                  <img src={product.image} alt={t(product.name)} className={`h-16 w-16 shrink-0 rounded-xl object-cover ${unavailable ? 'grayscale' : ''}`} />
                  <button
                    type="button"
                    disabled={unavailable}
                    aria-pressed={selected}
                    aria-label={t('hotpot_base.choose_base', { name: t(product.name) })}
                    onClick={() => toggle(product.id, preset?.productId === product.id ? preset.spec : t('hotpot_base.spec', { name: t(product.name) }))}
                    className="min-w-0 flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chili-500 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      <strong className="truncate font-bold text-charcoal-900">{t(product.name)}</strong>
                      {selected && <Check size={16} className="shrink-0 text-chili-500" />}
                    </span>
                    <span className="mt-1 block truncate text-xs text-charcoal-500">{flavorLabel ? `${t(product.description)} · ${flavorLabel}` : t(product.description)}</span>
                    <span className="mt-1 flex items-center gap-2 text-sm font-extrabold text-chili-500">
                      {money(product.price)}
                      {unavailable && <span className="rounded-full bg-charcoal-900/5 px-2 py-0.5 text-xs font-bold text-charcoal-500">{t('menu.sold_out')}</span>}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {invalid && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-100 p-3 text-sm font-semibold text-charcoal-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
            {t('hotpot_base.invalid_select')}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          {!required && submittedRef.current.length > 0 && (
            <Button
              variant="outline"
              className="sm:flex-1"
              onClick={() => {
                // 取消底料：清空并关闭；之后提交会被阻断，直到重新选择
                onConfirm([])
                setDraft([])
                allowCloseRef.current = true
                onOpenChange(false)
              }}
            >
              {t('hotpot_base.clear')}
            </Button>
          )}
          <Button className="sm:flex-1" disabled={noneAvailable} onClick={confirm}>{submittedRef.current.length ? t('hotpot_base.save') : t('hotpot_base.confirm')}</Button>
        </div>
        <p className="mt-3 text-center text-xs text-charcoal-500">{t('hotpot_base.footer')}</p>
      </DialogContent>
    </Dialog>
  )
}
