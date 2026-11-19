import { describe, it, expect } from 'vitest'
import '@/i18n'
import { orderReducer, initialState } from './orderReducer'
import type { AppAction, AppState, CartItem } from '@/types'

const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  uid: 'test-uid-1',
  productId: 'p3',
  name: 'menu.p3.name',
  price: 42,
  quantity: 1,
  image: '',
  spec: '',
  orderedBy: '姚乾',
  ...overrides,
})

const stateWithCart = (overrides: Partial<AppState> = {}): AppState => ({
  ...initialState,
  view: 'menu',
  table: 'A08',
  cart: [makeCartItem()],
  ...overrides,
})

describe('SET_HOTPOT_BASES', () => {
  it('sets hotpotBases when bases are provided', () => {
    const action: AppAction = { type: 'SET_HOTPOT_BASES', bases: [{ productId: 'p1', spec: 'mild' }] }
    const result = orderReducer(stateWithCart(), action)
    expect(result.hotpotBases).toEqual([{ productId: 'p1', spec: 'mild' }])
  })

  it('clears hotpotBases when empty array is provided', () => {
    const state = stateWithCart({ hotpotBases: [{ productId: 'p1', spec: 'mild' }] })
    const action: AppAction = { type: 'SET_HOTPOT_BASES', bases: [] }
    const result = orderReducer(state, action)
    expect(result.hotpotBases).toEqual([])
  })

  it('removes legacy base-* cart items when setting bases', () => {
    const baseCartItem = makeCartItem({ uid: 'base-legacy', productId: 'p1' })
    const normalItem = makeCartItem({ uid: 'normal-1', productId: 'p3' })
    const state: AppState = {
      ...initialState,
      view: 'menu',
      table: 'A08',
      cart: [baseCartItem, normalItem],
      hotpotBases: [{ productId: 'p1', spec: 'mild' }],
    }
    const action: AppAction = { type: 'SET_HOTPOT_BASES', bases: [{ productId: 'p2', spec: 'medium' }] }
    const result = orderReducer(state, action)
    expect(result.cart.find((item) => item.uid === 'base-legacy')).toBeUndefined()
    expect(result.cart.find((item) => item.uid === 'normal-1')).toBeDefined()
  })

  it('returns same state reference when bases are unchanged', () => {
    const bases = [{ productId: 'p1', spec: 'mild' }]
    const state = stateWithCart({ hotpotBases: bases })
    const action: AppAction = { type: 'SET_HOTPOT_BASES', bases: [...bases] }
    const result = orderReducer(state, action)
    expect(result).toBe(state)
  })

  it('does not clear cart when clearing bases', () => {
    const state = stateWithCart({
      hotpotBases: [{ productId: 'p1', spec: 'mild' }],
      cart: [makeCartItem()],
    })
    const action: AppAction = { type: 'SET_HOTPOT_BASES', bases: [] }
    const result = orderReducer(state, action)
    expect(result.cart.length).toBeGreaterThan(0)
  })
})

describe('SUBMIT_ORDER', () => {
  it('blocks submission when hotpotBases is empty and bases are required (TC-016)', () => {
    const state = stateWithCart({ hotpotBases: [], soldOut: ['p8'] })
    const action: AppAction = { type: 'SUBMIT_ORDER' }
    const result = orderReducer(state, action)
    expect(result.view).toBe('menu')
    expect(result.orderItems).toEqual([])
    expect(result.cart).toEqual([makeCartItem()])
  })

  it('blocks submission when cart is empty', () => {
    const state: AppState = {
      ...initialState,
      view: 'menu',
      table: 'A08',
      cart: [],
      hotpotBases: [{ productId: 'p1', spec: 'mild' }],
    }
    const action: AppAction = { type: 'SUBMIT_ORDER' }
    const result = orderReducer(state, action)
    expect(result.view).toBe('menu')
    expect(result.orderItems).toEqual([])
  })

  it('submits successfully when cart has items and hotpotBases is set', () => {
    const state = stateWithCart({ hotpotBases: [{ productId: 'p1', spec: 'mild' }] })
    const action: AppAction = { type: 'SUBMIT_ORDER' }
    const result = orderReducer(state, action)
    expect(result.view).toBe('order')
    expect(result.orderItems.length).toBe(1)
    expect(result.cart).toEqual([])
    expect(result.orderBases).toEqual([{ productId: 'p1', spec: 'mild' }])
  })

  it('does not create base order line items (avoid duplicate pricing)', () => {
    const state = stateWithCart({
      hotpotBases: [{ productId: 'p1', spec: 'mild' }],
      cart: [makeCartItem()],
    })
    const action: AppAction = { type: 'SUBMIT_ORDER' }
    const result = orderReducer(state, action)
    // orderItems should only contain the cart item, not the base
    expect(result.orderItems.every((item) => item.productId !== 'p1')).toBe(true)
  })

  it('repeated submit does not duplicate base charges (TC-017)', () => {
    const state1 = stateWithCart({
      hotpotBases: [{ productId: 'p2', spec: 'medium' }],
      cart: [makeCartItem()],
    })
    const afterFirst = orderReducer(state1, { type: 'SUBMIT_ORDER' })
    expect(afterFirst.orderBases).toEqual([{ productId: 'p2', spec: 'medium' }])

    // Add more items and submit again
    const withMoreItems: AppState = {
      ...afterFirst,
      view: 'menu',
      cart: [makeCartItem({ uid: 'test-uid-2', name: 'menu.p4.name' })],
    }
    const afterSecond = orderReducer(withMoreItems, { type: 'SUBMIT_ORDER' })
    // orderBases should still be a single base selection (not duplicated)
    expect(afterSecond.orderBases).toEqual([{ productId: 'p2', spec: 'medium' }])
    expect(afterSecond.orderBases.length).toBe(1)
  })

  it('preserves existing orderItems when submitting additional items', () => {
    const existingOrderItem = makeCartItem({ uid: 'existing-1' })
    const state: AppState = {
      ...initialState,
      view: 'menu',
      table: 'A08',
      cart: [makeCartItem({ uid: 'new-1' })],
      hotpotBases: [{ productId: 'p1', spec: 'mild' }],
      orderItems: [{ ...existingOrderItem, stage: 'submitted' as const }],
    }
    const action: AppAction = { type: 'SUBMIT_ORDER' }
    const result = orderReducer(state, action)
    expect(result.orderItems.length).toBe(2)
  })

  it('allows submission when all bases are sold out (degradation, TC-012)', () => {
    const state = stateWithCart({
      hotpotBases: [],
      soldOut: ['p1', 'p2', 'p8'], // all bases sold out → baseRequired=false
    })
    const action: AppAction = { type: 'SUBMIT_ORDER' }
    const result = orderReducer(state, action)
    expect(result.view).toBe('order')
    expect(result.orderItems.length).toBe(1)
    expect(result.orderBases).toEqual([]) // no bases, but allowed
  })
})

describe('RESET', () => {
  it('clears hotpotBases and orderBases on reset', () => {
    const state: AppState = {
      ...initialState,
      hotpotBases: [{ productId: 'p1', spec: 'mild' }],
      orderBases: [{ productId: 'p1', spec: 'mild' }],
      cart: [makeCartItem()],
      orderItems: [{ ...makeCartItem(), stage: 'submitted' as const }],
    }
    const action: AppAction = { type: 'RESET' }
    const result = orderReducer(state, action)
    expect(result.hotpotBases).toEqual([])
    expect(result.orderBases).toEqual([])
    expect(result.cart).toEqual([])
    expect(result.orderItems).toEqual([])
  })
})
