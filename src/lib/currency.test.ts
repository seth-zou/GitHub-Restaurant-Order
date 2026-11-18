import { describe, it, expect } from 'vitest'
import {
  CURRENCIES,
  CURRENCY_CODES,
  isCurrencyCode,
  roundMoney,
  formatMoney,
  sumLineTotals,
  calcDiscount,
  calcPayable,
  describeMoney,
  DISCOUNT_THRESHOLD,
  DISCOUNT_AMOUNT,
} from './currency'

describe('CurrencyCode & metadata', () => {
  it('CURRENCY_CODES contains exactly CNY, USD, JPY', () => {
    expect(CURRENCY_CODES).toEqual(['CNY', 'USD', 'JPY'])
  })

  it('CURRENCIES has correct fractionDigits per ISO 4217', () => {
    expect(CURRENCIES.CNY.fractionDigits).toBe(2)
    expect(CURRENCIES.USD.fractionDigits).toBe(2)
    expect(CURRENCIES.JPY.fractionDigits).toBe(0)
  })

  it('CURRENCIES has correct symbols', () => {
    expect(CURRENCIES.CNY.symbol).toBe('¥')
    expect(CURRENCIES.USD.symbol).toBe('$')
    expect(CURRENCIES.JPY.symbol).toBe('¥')
  })

  it('CURRENCIES has correct ISO numeric codes', () => {
    expect(CURRENCIES.CNY.numeric).toBe('156')
    expect(CURRENCIES.USD.numeric).toBe('840')
    expect(CURRENCIES.JPY.numeric).toBe('392')
  })

  it('isCurrencyCode accepts valid codes and rejects invalid (REQ-005.4: HKD not supported)', () => {
    expect(isCurrencyCode('CNY')).toBe(true)
    expect(isCurrencyCode('USD')).toBe(true)
    expect(isCurrencyCode('JPY')).toBe(true)
    expect(isCurrencyCode('HKD')).toBe(false)
    expect(isCurrencyCode('EUR')).toBe(false)
    expect(isCurrencyCode('')).toBe(false)
    expect(isCurrencyCode(null)).toBe(false)
    expect(isCurrencyCode(undefined)).toBe(false)
    expect(isCurrencyCode(123)).toBe(false)
  })
})

describe('roundMoney', () => {
  it('rounds CNY to 2 decimal places (REQ-001.2)', () => {
    expect(roundMoney(68, 'CNY')).toBe(68)
    expect(roundMoney(68.005, 'CNY')).toBe(68.01)
    expect(roundMoney(68.004, 'CNY')).toBe(68)
    expect(roundMoney(0.1 + 0.2, 'CNY')).toBe(0.3)
  })

  it('rounds USD to 2 decimal places (REQ-001.2)', () => {
    expect(roundMoney(88.5, 'USD')).toBe(88.5)
    expect(roundMoney(88.555, 'USD')).toBe(88.56)
    expect(roundMoney(88.554, 'USD')).toBe(88.55)
  })

  it('rounds JPY to 0 decimal places (REQ-001.3)', () => {
    expect(roundMoney(68, 'JPY')).toBe(68)
    expect(roundMoney(24.36, 'JPY')).toBe(24)
    expect(roundMoney(24.5, 'JPY')).toBe(25)
    expect(roundMoney(0.99, 'JPY')).toBe(1)
    expect(roundMoney(0.4, 'JPY')).toBe(0)
  })

  it('handles negative values', () => {
    expect(roundMoney(-24.36, 'JPY')).toBe(-24)
    expect(roundMoney(-30.567, 'CNY')).toBe(-30.57)
  })

  it('eliminates floating point artifacts (REQ-003.3)', () => {
    expect(roundMoney(0.1 + 0.2, 'CNY')).toBe(0.3)
    expect(roundMoney(0.1 + 0.2, 'JPY')).toBe(0)
  })
})

describe('formatMoney', () => {
  it('formats CNY with ¥ and 2 decimal places (REQ-001.1/001.2)', () => {
    expect(formatMoney(68, 'CNY')).toBe('¥68.00')
    expect(formatMoney(0, 'CNY')).toBe('¥0.00')
    expect(formatMoney(88.5, 'CNY')).toBe('¥88.50')
  })

  it('formats USD with $ and 2 decimal places (REQ-001.1/001.2)', () => {
    expect(formatMoney(68, 'USD')).toBe('$68.00')
    expect(formatMoney(88.5, 'USD')).toBe('$88.50')
  })

  it('formats JPY with ¥ and 0 decimal places (REQ-001.1/001.3)', () => {
    expect(formatMoney(68, 'JPY')).toBe('¥68')
    expect(formatMoney(0, 'JPY')).toBe('¥0')
    expect(formatMoney(24.36, 'JPY')).toBe('¥24')
  })

  it('uses thousands separators for amounts >= 1000 (REQ-001.4, MC-015)', () => {
    expect(formatMoney(1234, 'CNY')).toBe('¥1,234.00')
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50')
    expect(formatMoney(1234, 'JPY')).toBe('¥1,234')
    expect(formatMoney(1000000, 'JPY')).toBe('¥1,000,000')
  })

  it('rounds before formatting (REQ-001.6)', () => {
    expect(formatMoney(24.36, 'JPY')).toBe('¥24')
    expect(formatMoney(68.005, 'CNY')).toBe('¥68.01')
  })
})

describe('sumLineTotals', () => {
  it('sums line items for CNY (REQ-003.2)', () => {
    const items = [
      { price: 42, quantity: 2 },
      { price: 28, quantity: 1 },
      { price: 18, quantity: 1 },
    ]
    expect(sumLineTotals(items, 'CNY')).toBe(130)
  })

  it('sums line items for JPY rounding each line first (REQ-003.2/003.3)', () => {
    // roundMoney(24.36 * 2, 'JPY') = roundMoney(48.72, 'JPY') = 49
    const items = [
      { price: 24.36, quantity: 2 },
      { price: 28, quantity: 1 },
      { price: 18, quantity: 1 },
    ]
    expect(sumLineTotals(items, 'JPY')).toBe(95)
  })

  it('returns 0 for empty array', () => {
    expect(sumLineTotals([], 'CNY')).toBe(0)
    expect(sumLineTotals([], 'JPY')).toBe(0)
  })

  it('rounds each line before summing so line totals match subtotal (REQ-003.2)', () => {
    const items = [
      { price: 10.4, quantity: 3 }, // 31.2 → 31
      { price: 10.4, quantity: 3 }, // 31.2 → 31
    ]
    const subtotal = sumLineTotals(items, 'JPY')
    const lineSum = items.reduce((sum, item) => sum + roundMoney(item.price * item.quantity, 'JPY'), 0)
    expect(subtotal).toBe(62)
    expect(subtotal).toBe(roundMoney(lineSum, 'JPY'))
  })

  it('handles half-portion scenario from spec (MC-004: JPY 42×0.58=24.36→24)', () => {
    const items = [{ price: 24, quantity: 1 }]
    expect(sumLineTotals(items, 'JPY')).toBe(24)
  })
})

describe('calcDiscount', () => {
  it('returns DISCOUNT_AMOUNT when subtotal >= threshold (REQ-004.1)', () => {
    expect(calcDiscount(100, 'CNY')).toBe(DISCOUNT_AMOUNT)
    expect(calcDiscount(130, 'USD')).toBe(DISCOUNT_AMOUNT)
    expect(calcDiscount(130, 'JPY')).toBe(DISCOUNT_AMOUNT)
  })

  it('returns 0 when subtotal < threshold (REQ-004.2)', () => {
    expect(calcDiscount(99, 'CNY')).toBe(0)
    expect(calcDiscount(99.99, 'USD')).toBe(0)
    expect(calcDiscount(92, 'JPY')).toBe(0)
  })

  it('returns 0 at exactly 0', () => {
    expect(calcDiscount(0, 'CNY')).toBe(0)
  })

  it('never exceeds subtotal (REQ-004.4)', () => {
    expect(calcDiscount(100, 'CNY')).toBeLessThanOrEqual(100)
    expect(calcDiscount(130, 'CNY')).toBeLessThanOrEqual(130)
  })

  it('DISCOUNT_THRESHOLD is 100 and DISCOUNT_AMOUNT is 30', () => {
    expect(DISCOUNT_THRESHOLD).toBe(100)
    expect(DISCOUNT_AMOUNT).toBe(30)
  })
})

describe('calcPayable', () => {
  it('returns subtotal - discount when above threshold (REQ-004.1)', () => {
    expect(calcPayable(130, 'CNY')).toBe(100)
    expect(calcPayable(130, 'USD')).toBe(100)
    expect(calcPayable(130, 'JPY')).toBe(100)
  })

  it('returns subtotal when below threshold (REQ-004.2)', () => {
    expect(calcPayable(92, 'JPY')).toBe(92)
    expect(calcPayable(50, 'CNY')).toBe(50)
  })

  it('returns 0 when subtotal is 0', () => {
    expect(calcPayable(0, 'CNY')).toBe(0)
  })

  it('handles exactly threshold amount (REQ-004.1 boundary)', () => {
    expect(calcPayable(100, 'CNY')).toBe(70) // 100 - 30
  })
})

describe('describeMoney', () => {
  it('returns ISO code + formatted amount for CNY (REQ-006.2)', () => {
    expect(describeMoney(68, 'CNY')).toBe('CNY ¥68.00')
  })

  it('returns ISO code + formatted amount for USD', () => {
    expect(describeMoney(88.5, 'USD')).toBe('USD $88.50')
  })

  it('disambiguates JPY from CNY when both use ¥ symbol (REQ-006.2)', () => {
    expect(describeMoney(68, 'JPY')).toBe('JPY ¥68')
    expect(describeMoney(68, 'CNY')).toBe('CNY ¥68.00')
    expect(describeMoney(68, 'CNY')).not.toBe(describeMoney(68, 'JPY'))
  })
})

describe('REQ-003: line totals sum equals subtotal (MC-006 scenario)', () => {
  it('JPY 42×2 + 28 + 18 = 130, line sum = subtotal', () => {
    const items = [
      { price: 42, quantity: 2 },
      { price: 28, quantity: 1 },
      { price: 18, quantity: 1 },
    ]
    const subtotal = sumLineTotals(items, 'JPY')
    const lineSum = items.reduce((sum, item) => sum + roundMoney(item.price * item.quantity, 'JPY'), 0)
    expect(subtotal).toBe(130)
    expect(subtotal).toBe(roundMoney(lineSum, 'JPY'))
  })

  it('USD 42×2 + 28 + 18 = 130.00 (MC-005 scenario)', () => {
    const items = [
      { price: 42, quantity: 2 },
      { price: 28, quantity: 1 },
      { price: 18, quantity: 1 },
    ]
    const subtotal = sumLineTotals(items, 'USD')
    expect(subtotal).toBe(130)
    expect(formatMoney(subtotal, 'USD')).toBe('$130.00')
  })

  it('JPY half portion 42×0.58=24.36→24 (MC-004 scenario)', () => {
    const halfPrice = roundMoney(42 * 0.58, 'JPY')
    expect(halfPrice).toBe(24)
    expect(formatMoney(halfPrice, 'JPY')).toBe('¥24')
  })
})

describe('REQ-004: discount and payable scenarios', () => {
  it('MC-005: USD subtotal 130 → discount 30 → payable 100', () => {
    const subtotal = 130
    const discount = calcDiscount(subtotal, 'USD')
    const payable = calcPayable(subtotal, 'USD')
    expect(discount).toBe(30)
    expect(payable).toBe(100)
    expect(formatMoney(discount, 'USD')).toBe('$30.00')
    expect(formatMoney(payable, 'USD')).toBe('$100.00')
  })

  it('MC-006: JPY subtotal 130 → discount 30 → payable 100', () => {
    const subtotal = 130
    const discount = calcDiscount(subtotal, 'JPY')
    const payable = calcPayable(subtotal, 'JPY')
    expect(discount).toBe(30)
    expect(payable).toBe(100)
    expect(formatMoney(discount, 'JPY')).toBe('¥30')
    expect(formatMoney(payable, 'JPY')).toBe('¥100')
  })

  it('MC-013: JPY subtotal 42 < 100 → no discount → payable = subtotal', () => {
    const subtotal = 42
    const discount = calcDiscount(subtotal, 'JPY')
    const payable = calcPayable(subtotal, 'JPY')
    expect(discount).toBe(0)
    expect(payable).toBe(42)
  })
})

describe('REQ-001.4: thousands separator (MC-015)', () => {
  it('CNY 1234 → ¥1,234.00', () => {
    expect(formatMoney(1234, 'CNY')).toBe('¥1,234.00')
  })

  it('USD 1234.5 → $1,234.50', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50')
  })

  it('JPY 1234 → ¥1,234 (no decimal)', () => {
    expect(formatMoney(1234, 'JPY')).toBe('¥1,234')
  })
})
