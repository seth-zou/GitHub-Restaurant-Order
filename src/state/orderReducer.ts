import i18next from 'i18next'
import { uid } from '@/lib/utils'
import { hasSelectableBases } from '@/lib/hotpot'
import type { AppAction, AppState } from '@/types'

export const initialState: AppState = {
  view: 'home',
  table: null,
  diners: ['姚乾', '林溪', '陈默'],
  cart: [],
  hotpotBases: [],
  orderBases: [],
  orderItems: [],
  orderStage: 'submitted',
  soldOut: ['p8'],
  services: [],
  paid: false,
  lastMessage: i18next.t('message.welcome'),
}

const stageMessages: Record<string, string> = {
  submitted: 'message.stage_submitted',
  accepted: 'message.stage_accepted',
  cooking: 'message.stage_cooking',
  served: 'message.stage_served',
}

const localeForLanguage = (lang: string) => (lang === 'en' ? 'en-US' : 'zh-CN')

export function orderReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'BIND_TABLE':
      return { ...state, table: action.table, view: 'welcome', lastMessage: i18next.t('message.bind_table', { table: action.table }) }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'ADD_CART': {
      const same = state.cart.find((item) => item.productId === action.item.productId && item.spec === action.item.spec && item.orderedBy === action.item.orderedBy)
      const cart = same
        ? state.cart.map((item) => item.uid === same.uid ? { ...item, quantity: item.quantity + 1 } : item)
        : [...state.cart, action.item]
      return { ...state, cart, lastMessage: i18next.t('message.add_cart', { name: action.item.orderedBy, dish: action.item.name }) }
    }
    case 'CHANGE_QTY': {
      const cart = state.cart
        .map((item) => item.uid === action.uid ? { ...item, quantity: item.quantity + action.delta } : item)
        .filter((item) => item.quantity > 0)
      return { ...state, cart }
    }
    case 'SET_HOTPOT_BASES': {
      // 逐字段比较，避免对可能带额外引用的对象做 JSON 序列化
      const changed = state.hotpotBases.length !== action.bases.length
        || state.hotpotBases.some((base, index) => base.productId !== action.bases[index]?.productId || base.spec !== action.bases[index]?.spec)
      if (!changed) return state
      const cart = state.cart.filter((item) => !item.uid.startsWith('base-'))
      return { ...state, hotpotBases: action.bases, cart, lastMessage: i18next.t('message.hotpot_base_updated') }
    }
    case 'SUBMIT_ORDER': {
      // 底料是整桌必选环节：未选择时不允许提交（统一由调用方提示，这里做数据兜底）
      // 全部底料售罄时为降级场景（baseRequired=false），不阻塞提交
      const baseRequired = hasSelectableBases(state.soldOut)
      if (!state.cart.length) return state
      if (baseRequired && !state.hotpotBases.length) return state
      // 底料单独保存在 orderBases，不再作为独立订单行，避免订单/结账重复展示与重复计价
      const additions = state.cart.map((item) => ({ ...item, stage: 'submitted' as const }))
      return {
        ...state,
        orderItems: [...state.orderItems, ...additions],
        orderBases: state.hotpotBases,
        cart: [],
        orderStage: 'submitted',
        view: 'order',
        lastMessage: state.orderItems.length ? i18next.t('message.order_additional') : i18next.t('message.order_submitted'),
      }
    }
    case 'SET_STAGE':
      return {
        ...state,
        orderStage: action.stage,
        orderItems: state.orderItems.map((item) => ({ ...item, stage: action.stage })),
        lastMessage: i18next.t(stageMessages[action.stage]),
      }
    case 'TOGGLE_SOLD_OUT':
      return {
        ...state,
        soldOut: state.soldOut.includes(action.productId)
          ? state.soldOut.filter((id) => id !== action.productId)
          : [...state.soldOut, action.productId],
        lastMessage: i18next.t('message.soldout_updated'),
      }
    case 'CALL_SERVICE': {
      const serviceName = i18next.t(`${action.service}.name`)
      return {
        ...state,
        services: [...state.services, { id: uid(), type: serviceName, createdAt: new Date().toLocaleTimeString(localeForLanguage(i18next.language), { hour: '2-digit', minute: '2-digit' }), status: 'waiting' }],
        lastMessage: i18next.t('message.service_called', { service: serviceName }),
      }
    }
    case 'RESPOND_SERVICES':
      return { ...state, services: state.services.map((service) => ({ ...service, status: 'responded' })), lastMessage: i18next.t('message.service_responded') }
    case 'REQUEST_CANCEL':
      return {
        ...state,
        orderItems: state.orderItems.map((item) => item.uid === action.uid ? { ...item, cancelState: 'requested' } : item),
        lastMessage: i18next.t('message.cancel_requested'),
      }
    case 'PAY':
      return { ...state, paid: true, lastMessage: i18next.t('message.paid') }
    case 'RESET':
      return { ...initialState, lastMessage: i18next.t('message.reset') }
    case 'SET_MESSAGE':
      return { ...state, lastMessage: action.message }
    default:
      return state
  }
}
