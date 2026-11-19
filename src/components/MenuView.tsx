import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Baby, Check, Flame, Plus, Search, Soup, Sparkles, Users } from 'lucide-react'
import { categories, products } from '@/data/menu'
import { isSpicyForChildren } from '@/hooks/useChildMode'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { money, uid } from '@/lib/utils'
import type { CartItem, HotpotBaseSelection, Product } from '@/types'

interface MenuViewProps {
  child: boolean
  diners: string[]
  soldOut: string[]
  hotpotBaseIds: string[]
  onAdd: (item: CartItem) => void
  /** 从菜单规格页进入底料环节：携带已选规格（含辣度） */
  onPickBase: (preset?: HotpotBaseSelection) => void
}

export function MenuView({ child, diners, soldOut, hotpotBaseIds, onAdd, onPickBase }: MenuViewProps) {
  const { t } = useTranslation()
  const [showSpicy, setShowSpicy] = useState(false)
  const [category, setCategory] = useState('menu.cat.recommend')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [portion, setPortion] = useState('menu.option.full')
  const [flavor, setFlavor] = useState('')
  const [spicy, setSpicy] = useState('menu.option.mild')
  const [showRiskWarning, setShowRiskWarning] = useState(false)
  const [diner, setDiner] = useState(diners[0])

  const handleSpicyChange = (option: string) => {
    // 儿童模式：超级辣不可选（按钮已 disabled），即使触发也不设置
    if (option === 'menu.option.super_spicy') {
      if (!child) setShowRiskWarning(true)
      // 儿童模式：不弹风险提示，不进入选中态
      return
    }
    setSpicy(option)
  }

  const confirmSuperSpicy = () => {
    setSpicy('menu.option.super_spicy')
    setShowRiskWarning(false)
  }

  const cancelSuperSpicy = () => {
    setShowRiskWarning(false)
  }

  // 儿童模式展示简化：含"超级辣"的锅底默认隐藏，用户可手动展开。
  const spicyProducts = useMemo(() => products.filter(isSpicyForChildren), [])
  const childHiddenCount = useMemo(() => spicyProducts.filter((product) => !soldOut.includes(product.id)).length, [spicyProducts, soldOut])

  const visible = useMemo(() => products.filter((product) => {
    if (child && !showSpicy && isSpicyForChildren(product)) return false
    const matchCategory = category === 'menu.cat.recommend' || product.category === category
    const productName = t(product.name)
    const productDesc = t(product.description)
    const matchSearch = productName.includes(search) || productDesc.includes(search)
    return matchCategory && matchSearch
  }), [category, search, t, child, showSpicy])

  const openSpec = (product: Product) => {
    setSelected(product)
    setPortion(product.options?.portion?.[1] || product.options?.portion?.[0] || '')
    setFlavor(product.options?.flavor?.[0] || '')
    setSpicy(product.options?.spicy?.[0] || '')
  }

  const buildSelectedItem = (): CartItem => {
    if (!selected) throw new Error('no selected product')
    const portionFactor = portion === 'menu.option.half' ? 0.58 : 1
    const specParts = [portion, flavor, spicy].filter(Boolean).map((key) => t(key))
    if (spicy === 'menu.option.super_spicy') {
      specParts.push(t('cart.confirmed_risk'))
    }
    const spec = specParts.join(' · ') || t('menu.standard')
    return { uid: uid(), productId: selected.id, name: t(selected.name), price: Math.round(selected.price * portionFactor), quantity: 1, image: selected.image, spec, orderedBy: diner }
  }

  const addSelected = (orderedBy = diner) => {
    if (!selected) return
    if (selected.isHotpotBase) {
      // 底料从菜单进入规格：确认后转为本桌底料选择（进入底料环节确认），不直接作为普通菜品加购
      const item = buildSelectedItem()
      setSelected(null)
      onPickBase({ productId: String(item.productId), spec: String(item.spec) })
      return
    }
    onAdd(orderedBy !== diner ? { ...buildSelectedItem(), orderedBy } : buildSelectedItem())
    setSelected(null)
  }

  return (
    <section className="min-w-0">
      <div className="relative overflow-hidden rounded-3xl bg-charcoal-900 p-5 text-white shadow-card sm:p-7">
        <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-chili-500/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><span className="flex items-center gap-2 text-xs font-bold text-amber-400"><Sparkles size={14} />{t('menu.hero_badge')}</span><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{t('menu.hero_title')}</h1>{!child && <p className="mt-2 text-sm text-rice-200">{t('menu.hero_diners', { count: diners.length })}</p>}</div>
          <div className="flex -space-x-2">{diners.map((name, index) => <span key={name} title={name} className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-charcoal-900 text-xs font-bold ${index === 0 ? 'bg-chili-500' : index === 1 ? 'bg-amber-400 text-charcoal-900' : 'bg-rice-200 text-charcoal-900'}`}>{name.slice(0, 1)}</span>)}</div>
        </div>
      </div>

      <div className="sticky top-24 z-20 -mx-4 mt-5 bg-rice-100/95 px-4 pb-3 backdrop-blur lg:mx-0 lg:px-0">
        <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-500" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('menu.search_placeholder')} className="h-12 w-full rounded-2xl border border-charcoal-900/5 bg-white pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-chili-500/30 focus:ring-4 focus:ring-chili-50" /></div>
        {child && (
          <div data-testid="child-mode-banner" className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-100/70 px-4 py-3 text-sm text-charcoal-700">
            <Baby size={20} className="shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{t('menu.child_banner_title')}</p>
              <p className="text-xs text-charcoal-500">{t('menu.child_hidden', { count: childHiddenCount })}</p>
            </div>
            {childHiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSpicy((prev) => !prev)}
                className="touch-chip shrink-0 rounded-full border border-charcoal-900/10 bg-white px-4 py-2 text-xs font-bold text-charcoal-700"
                aria-pressed={showSpicy}
                data-testid="child-show-spicy"
              >
                {showSpicy ? t('menu.child_spicy_hide') : t('menu.child_spicy_show')}
              </button>
            )}
          </div>
        )}
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`touch-chip whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${category === item ? 'bg-chili-500 text-white shadow-md' : 'bg-white text-charcoal-500 hover:text-chili-500'}`}>{t(item)}</button>)}
        </div>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {visible.map((product, index) => {
          const unavailable = soldOut.includes(product.id)
          return (
            <article key={product.id} className={`group animate-rise overflow-hidden rounded-3xl border bg-white shadow-card transition hover:-translate-y-1 ${product.isHotpotBase ? 'border-amber-400/40' : 'border-charcoal-900/5'}`} style={{ animationDelay: `${index * 40}ms` }}>
              <div className="relative h-40 overflow-hidden child-card-media">
                <img src={product.image} alt={t(product.name)} className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${unavailable ? 'grayscale' : ''}`} />
                {!child && <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/45 to-transparent" />}
                {product.badge && !child && <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-charcoal-900">{t(product.badge)}</span>}
                {product.isHotpotBase && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-extrabold text-chili-600">{hotpotBaseIds.includes(product.id) ? <Check size={13} /> : <Soup size={13} />}{hotpotBaseIds.includes(product.id) ? t('hotpot_base.entry_change') : t('hotpot_base.entry_select')}</span>}
                {unavailable && <span className="absolute inset-0 flex items-center justify-center bg-white/55 text-lg font-extrabold text-charcoal-900 backdrop-blur-sm">{t('menu.sold_out')}</span>}
                {product.orderedCount && !child && <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-chili-600"><Check size={13} />{t('menu.ordered_table', { count: product.orderedCount })}</span>}
              </div>
              <div className="child-card-body p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="child-card-title font-extrabold text-charcoal-900">{t(product.name)}</h3>{!child && <p className="mt-1 line-clamp-1 text-xs text-charcoal-500">{t(product.description)}</p>}{product.isHotpotBase && <p className="mt-1 text-xs font-semibold text-amber-500">{t('menu.base_pick_hint')}</p>}</div><Button size="icon" variant={product.isHotpotBase ? 'secondary' : 'default'} disabled={unavailable} onClick={() => openSpec(product)} aria-label={product.isHotpotBase ? t('hotpot_base.choose_base', { name: t(product.name) }) : t('menu.add_dish_aria', { name: t(product.name) })} className="child-add-btn h-10 w-10 shrink-0 rounded-full">{product.isHotpotBase ? <Soup size={18} /> : <Plus size={18} />}</Button></div><p className="child-price mt-4 text-xl font-extrabold text-chili-500">{money(product.price)} <small className="text-xs font-medium text-charcoal-500">{child ? t('menu.per_portion') : t('menu.from')}</small></p></div>
            </article>
          )
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setShowRiskWarning(false) } }}>
        <DialogContent title={selected ? t(selected.name) : ''}>
          {selected?.isHotpotBase && (
            <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-charcoal-700">{t('hotpot_base.from_menu_hint')}</p>
          )}
          {selected && child && <>
            <div className="mt-4 flex gap-4 rounded-2xl bg-white p-3"><img src={selected.image} alt={t(selected.name)} className="h-24 w-24 rounded-xl object-cover" /><div><p className="text-sm leading-6 text-charcoal-500">{t(selected.description)}</p><p className="mt-2 text-xl font-extrabold text-chili-500">{money(selected.price)} <small className="text-xs font-medium text-charcoal-500">{t('menu.per_portion')}</small></p></div></div>
            {selected.options?.portion && <OptionRow label={t('menu.select_portion')} options={selected.options.portion} value={portion} onChange={setPortion} t={t} />}
            {selected.options?.flavor && <OptionRow label={t('menu.select_flavor')} options={selected.options.flavor} value={flavor} onChange={setFlavor} t={t} />}
            {selected.options?.spicy && <OptionRow label={t('menu.select_spicy')} icon={<Flame size={15} className="text-chili-500" />} options={selected.options.spicy} value={spicy} onChange={handleSpicyChange} t={t} disabledOptions={['menu.option.super_spicy']} />}
            <Button onClick={() => addSelected(diners[0])} className="mt-6 w-full child-add-btn"><Plus size={17} />{selected.isHotpotBase ? t('hotpot_base.add_as_base') : t('menu.child_add_to_cart')}</Button>
          </>}
          {selected && !child && <>
            <div className="mt-4 flex gap-4 rounded-2xl bg-white p-3"><img src={selected.image} alt={t(selected.name)} className="h-24 w-24 rounded-xl object-cover" /><div><p className="text-sm leading-6 text-charcoal-500">{t(selected.description)}</p><p className="mt-2 text-xl font-extrabold text-chili-500">{money(selected.price)} <small className="text-xs font-medium text-charcoal-500">{t('menu.from')}</small></p></div></div>
            {selected.options?.portion && <OptionRow label={t('menu.select_portion')} options={selected.options.portion} value={portion} onChange={setPortion} t={t} />}
            {selected.options?.flavor && <OptionRow label={t('menu.select_flavor')} options={selected.options.flavor} value={flavor} onChange={setFlavor} t={t} />}
            {selected.options?.spicy && <OptionRow label={t('menu.select_spicy')} icon={<Flame size={15} className="text-chili-500" />} options={selected.options.spicy} value={spicy} onChange={handleSpicyChange} t={t} />}
            <div className="mt-5"><p className="mb-3 flex items-center gap-2 text-sm font-bold text-charcoal-900"><Users size={16} />{t('menu.who_ordered')}</p><div className="flex gap-2">{diners.map((name) => <button key={name} onClick={() => setDiner(name)} className={`rounded-full px-4 py-2 text-sm font-bold ${diner === name ? 'bg-amber-400 text-charcoal-900' : 'bg-white text-charcoal-500'}`}>{name}</button>)}</div></div>
            <Button onClick={() => addSelected()} className="mt-6 w-full"><Plus size={17} />{selected.isHotpotBase ? t('hotpot_base.add_as_base') : t('menu.add_to_cart')}</Button>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={showRiskWarning} onOpenChange={(open) => !open && cancelSuperSpicy()}>
        <DialogContent title={t('menu.super_spicy_warning_title')}>
          <div className='mt-4 flex flex-col items-center gap-4'>
            <span className='flex h-14 w-14 items-center justify-center rounded-2xl bg-chili-50 text-chili-500'><AlertTriangle size={28} /></span>
            <p className='text-center text-sm leading-6 text-charcoal-700'>{t('menu.super_spicy_warning')}</p>
            <div className='flex w-full gap-3'>
              <Button variant='outline' className='flex-1' onClick={cancelSuperSpicy}>{t('menu.super_spicy_cancel')}</Button>
              <Button className='flex-1' onClick={confirmSuperSpicy}>{t('menu.super_spicy_confirm')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

type TFunc = (key: string, options?: Record<string, unknown>) => string

function OptionRow({ label, icon, options, value, onChange, t, disabledOptions }: { label: string; icon?: React.ReactNode; options: string[]; value: string; onChange: (value: string) => void; t: TFunc; disabledOptions?: string[] }) {
  return <div className="mt-5"><p className="mb-3 flex items-center gap-2 text-sm font-bold text-charcoal-900">{icon}{label}</p><div className="flex flex-wrap gap-2">{options.map((option) => {
    const disabled = disabledOptions?.includes(option)
    return <button key={option} disabled={disabled} onClick={() => !disabled && onChange(option)} className={`touch-option rounded-xl border px-4 py-2 text-sm font-semibold transition ${disabled ? 'cursor-not-allowed border-charcoal-900/5 bg-rice-100 text-charcoal-500/40' : value === option ? 'border-chili-500 bg-chili-50 text-chili-600' : 'border-charcoal-900/10 bg-white text-charcoal-500'}`}>{t(option)}</button>
  })}</div></div>
}
