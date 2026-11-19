export type OrderStage = 'submitted' | 'accepted' | 'cooking' | 'served'
export type ViewName = 'home' | 'welcome' | 'menu' | 'order' | 'checkout'

export interface Product {
  id: string
  name: string
  description: string
  category: string
  price: number
  image: string
  badge?: string
  orderedCount?: number
  /** 火锅底料必须由“选底料”环节选择，不允许作为普通菜品加入购物车 */
  isHotpotBase?: boolean
  options?: {
    portion?: string[]
    flavor?: string[]
    spicy?: string[]
  }
}

export interface CartItem {
  uid: string
  productId: string
  name: string
  price: number
  quantity: number
  image: string
  spec: string
  orderedBy: string
}

export interface OrderItem extends CartItem {
  stage: OrderStage
  cancelState?: 'requested' | 'approved'
}

export interface HotpotBaseSelection {
  productId: string
  spec: string
}

export interface ServiceRequest {
  id: string
  type: string
  createdAt: string
  status: 'waiting' | 'responded'
}

export interface AppState {
  view: ViewName
  table: string | null
  diners: string[]
  cart: CartItem[]
  /** 本桌点餐会话已确认的火锅底料；加菜沿用，整桌重置后清空 */
  hotpotBases: HotpotBaseSelection[]
  /** 已加入本桌订单（含加菜提交）的底料，用于订单详情与结账展示 */
  orderBases: HotpotBaseSelection[]
  orderItems: OrderItem[]
  orderStage: OrderStage
  soldOut: string[]
  services: ServiceRequest[]
  paid: boolean
  lastMessage: string
}

export type AppAction =
  | { type: 'BIND_TABLE'; table: string }
  | { type: 'SET_VIEW'; view: ViewName }
  | { type: 'ADD_CART'; item: CartItem }
  | { type: 'SET_HOTPOT_BASES'; bases: HotpotBaseSelection[] }
  | { type: 'CHANGE_QTY'; uid: string; delta: number }
  | { type: 'SUBMIT_ORDER' }
  | { type: 'SET_STAGE'; stage: OrderStage }
  | { type: 'TOGGLE_SOLD_OUT'; productId: string }
  | { type: 'CALL_SERVICE'; service: string }
  | { type: 'RESPOND_SERVICES' }
  | { type: 'REQUEST_CANCEL'; uid: string }
  | { type: 'PAY' }
  | { type: 'RESET' }
  | { type: 'SET_MESSAGE'; message: string }
