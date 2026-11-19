import { describe, it, expect } from 'vitest'
import '@/i18n'
import {
  hasSelectableBases,
  isBaseSelectionValid,
  describeBases,
  basesTotal,
  basesSummary,
  MAX_HOTPOT_BASES,
} from './hotpot'
import type { HotpotBaseSelection } from '@/types'

describe('hasSelectableBases', () => {
  it('returns true when no bases are sold out', () => {
    expect(hasSelectableBases([])).toBe(true)
  })

  it('returns true when only some bases are sold out', () => {
    expect(hasSelectableBases(['p1'])).toBe(true)
    expect(hasSelectableBases(['p2'])).toBe(true)
  })

  it('returns false when all bases are sold out', () => {
    expect(hasSelectableBases(['p1', 'p2'])).toBe(false)
  })

  it('returns true when soldOut contains non-base products only', () => {
    expect(hasSelectableBases(['p8'])).toBe(true)
  })
})

describe('isBaseSelectionValid', () => {
  it('returns false for empty selection', () => {
    expect(isBaseSelectionValid([], [])).toBe(false)
  })

  it('returns true for a single valid base', () => {
    const bases: HotpotBaseSelection[] = [{ productId: 'p1', spec: 'mild' }]
    expect(isBaseSelectionValid(bases, [])).toBe(true)
  })

  it('returns true for two valid bases (double combo)', () => {
    const bases: HotpotBaseSelection[] = [
      { productId: 'p1', spec: 'mild' },
      { productId: 'p2', spec: 'medium' },
    ]
    expect(isBaseSelectionValid(bases, [])).toBe(true)
  })

  it('returns false when exceeding MAX_HOTPOT_BASES', () => {
    const bases: HotpotBaseSelection[] = [
      { productId: 'p1', spec: 'a' },
      { productId: 'p2', spec: 'b' },
      { productId: 'p3', spec: 'c' }, // p3 is not a base, but even so, count > MAX
    ]
    expect(bases.length > MAX_HOTPOT_BASES).toBe(true)
    expect(isBaseSelectionValid(bases, [])).toBe(false)
  })

  it('returns false when a selected base is sold out', () => {
    const bases: HotpotBaseSelection[] = [{ productId: 'p1', spec: 'mild' }]
    expect(isBaseSelectionValid(bases, ['p1'])).toBe(false)
  })

  it('returns false when productId is not a hotpot base product', () => {
    const bases: HotpotBaseSelection[] = [{ productId: 'p3', spec: '' }]
    expect(isBaseSelectionValid(bases, [])).toBe(false)
  })

  it('returns false when productId does not exist', () => {
    const bases: HotpotBaseSelection[] = [{ productId: 'nonexistent', spec: '' }]
    expect(isBaseSelectionValid(bases, [])).toBe(false)
  })
})

describe('describeBases', () => {
  const t = (key: string) => key // identity for testing

  it('returns empty string for empty selection', () => {
    expect(describeBases([], t)).toBe('')
  })

  it('returns translated product name for single selection', () => {
    const bases: HotpotBaseSelection[] = [{ productId: 'p1', spec: 'mild' }]
    expect(describeBases(bases, t)).toBe('menu.p1.name')
  })

  it('returns combined names with combo suffix for double selection', () => {
    const bases: HotpotBaseSelection[] = [
      { productId: 'p1', spec: 'mild' },
      { productId: 'p2', spec: 'medium' },
    ]
    expect(describeBases(bases, t)).toBe('menu.p1.name + menu.p2.name · hotpot_base.combo')
  })
})

describe('basesTotal', () => {
  it('returns 0 for empty selection', () => {
    expect(basesTotal([])).toBe(0)
  })

  it('returns correct price for single base (p1 = ¥68)', () => {
    const bases: HotpotBaseSelection[] = [{ productId: 'p1', spec: '' }]
    expect(basesTotal(bases)).toBe(68)
  })

  it('returns correct total for two bases (p1 + p2 = ¥127)', () => {
    const bases: HotpotBaseSelection[] = [
      { productId: 'p1', spec: '' },
      { productId: 'p2', spec: '' },
    ]
    expect(basesTotal(bases)).toBe(127)
  })
})

describe('basesSummary', () => {
  const t = (key: string) => key

  it('combines description and formatted money', () => {
    const bases: HotpotBaseSelection[] = [{ productId: 'p1', spec: '' }]
    expect(basesSummary(bases, t)).toBe('menu.p1.name · ¥68.00')
  })

  it('combines description and formatted money for double combo', () => {
    const bases: HotpotBaseSelection[] = [
      { productId: 'p1', spec: '' },
      { productId: 'p2', spec: '' },
    ]
    expect(basesSummary(bases, t)).toBe('menu.p1.name + menu.p2.name · hotpot_base.combo · ¥127.00')
  })
})
