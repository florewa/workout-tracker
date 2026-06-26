import { describe, it, expect } from 'vitest'
import { e1rm, tonnage } from '~/server/utils/metrics'

describe('tonnage', () => {
  it('перемножает вес и повторы', () => {
    expect(tonnage(16, 10)).toBe(160)
    expect(tonnage(65, 12)).toBe(780)
  })
})

describe('e1rm (Эпли)', () => {
  it('60кг×10 → 80', () => {
    expect(e1rm(60, 10)).toBe(80)
  })
  it('65кг×12 → 91', () => {
    expect(e1rm(65, 12)).toBe(91)
  })
  it('14кг×12 → 19.6', () => {
    expect(e1rm(14, 12)).toBe(19.6)
  })
  it('24кг×10 → 32', () => {
    expect(e1rm(24, 10)).toBe(32)
  })
})
