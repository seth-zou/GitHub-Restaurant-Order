import hotpot from '@/assets/hotpot.jpg'
import vegetables from '@/assets/vegetables.jpg'
import beef from '@/assets/beef.jpg'
import broth from '@/assets/broth.jpg'
import type { CurrencyCode } from '@/lib/currency'
import type { Product } from '@/types'

export const categories = ['menu.cat.recommend', 'menu.cat.broth', 'menu.cat.meat', 'menu.cat.seafood', 'menu.cat.veggie', 'menu.cat.staple']

export const tableAreas: Record<string, string> = {
  'A08': 'bind.area.hall',
  'B12': 'bind.area.booth',
  'C06': 'bind.area.room',
  'D03': 'bind.area.window',
}

/**
 * 演示门店：桌台前缀 → 门店。每张桌台归属一家门店，整桌按该门店的定价币种展示与加算。
 * 币种是门店属性，顾客不可切换；演示数据为产品规则 DEFAULT-2 的示例，真实门店映射由后续数据源提供。
 */
export interface Store {
  id: string
  nameKey: string
  currency: CurrencyCode
}

export const stores: Store[] = [
  { id: 'xingheli', nameKey: 'store.xingheli', currency: 'CNY' },
  { id: 'harbor', nameKey: 'store.harbor', currency: 'USD' },
  { id: 'mongkok', nameKey: 'store.mongkok', currency: 'HKD' },
  { id: 'shinjuku', nameKey: 'store.shinjuku', currency: 'JPY' },
]

export const tableStore: Record<string, string> = {
  A08: 'xingheli',
  B12: 'harbor',
  C06: 'mongkok',
  D03: 'shinjuku',
}

/** 桌台对应的门店；未知桌台回落到默认门店（人民币）。 */
export const getStoreByTable = (table: string | null): Store =>
  stores.find((store) => store.id === tableStore[table ?? '']) ?? stores[0]

export const getCurrencyByTable = (table: string | null): CurrencyCode => getStoreByTable(table).currency

/** 由币种反查演示门店（币种预览/深链接使用）。 */
export const getStoreByCurrency = (currency: string | null | undefined): Store | undefined =>
  stores.find((store) => store.currency === currency?.toUpperCase())

export const products: Product[] = [
  {
    id: 'p1', name: 'menu.p1.name', category: 'menu.cat.broth', price: 68,
    description: 'menu.p1.desc', image: hotpot, badge: 'menu.badge.popular',
    options: { flavor: ['menu.option.tomato_beef', 'menu.option.mushroom_beef'], spicy: ['menu.option.mild', 'menu.option.medium', 'menu.option.heavy', 'menu.option.super_spicy'] },
  },
  {
    id: 'p2', name: 'menu.p2.name', category: 'menu.cat.broth', price: 59,
    description: 'menu.p2.desc', image: broth, badge: 'menu.badge.signature',
    options: { spicy: ['menu.option.mild', 'menu.option.medium', 'menu.option.heavy', 'menu.option.super_spicy'] },
  },
  {
    id: 'p3', name: 'menu.p3.name', category: 'menu.cat.meat', price: 42,
    description: 'menu.p3.desc', image: beef, badge: 'menu.badge.chef', orderedCount: 1,
    options: { portion: ['menu.option.half', 'menu.option.full'], flavor: ['menu.option.original', 'menu.option.spicy_marinate'] },
  },
  {
    id: 'p4', name: 'menu.p4.name', category: 'menu.cat.meat', price: 48,
    description: 'menu.p4.desc', image: beef,
    options: { portion: ['menu.option.half', 'menu.option.full'] },
  },
  {
    id: 'p5', name: 'menu.p5.name', category: 'menu.cat.seafood', price: 39,
    description: 'menu.p5.desc', image: hotpot, badge: 'menu.badge.new', orderedCount: 2,
    options: { portion: ['menu.option.half', 'menu.option.full'] },
  },
  {
    id: 'p6', name: 'menu.p6.name', category: 'menu.cat.seafood', price: 46,
    description: 'menu.p6.desc', image: hotpot,
    options: { portion: ['menu.option.half', 'menu.option.full'] },
  },
  {
    id: 'p7', name: 'menu.p7.name', category: 'menu.cat.veggie', price: 28,
    description: 'menu.p7.desc', image: vegetables, orderedCount: 1,
    options: { portion: ['menu.option.half', 'menu.option.full'] },
  },
  {
    id: 'p8', name: 'menu.p8.name', category: 'menu.cat.veggie', price: 32,
    description: 'menu.p8.desc', image: vegetables,
    options: { portion: ['menu.option.half', 'menu.option.full'] },
  },
  {
    id: 'p9', name: 'menu.p9.name', category: 'menu.cat.staple', price: 16,
    description: 'menu.p9.desc', image: broth,
    options: { portion: ['menu.option.half', 'menu.option.full'] },
  },
  {
    id: 'p10', name: 'menu.p10.name', category: 'menu.cat.staple', price: 18,
    description: 'menu.p10.desc', image: vegetables,
    options: { flavor: ['menu.option.less_ice', 'menu.option.normal_ice', 'menu.option.no_ice'] },
  },
]

export const getProduct = (id: string) => products.find((product) => product.id === id)
