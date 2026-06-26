import { describe, it, expect } from 'vitest'
import { parseWeekday } from '~~/scripts/backfill-weekday'

describe('parseWeekday', () => {
  it('распознаёт ПОНЕДЕЛЬНИК → 1', () => {
    expect(parseWeekday('ДЕНЬ 1 — ПОНЕДЕЛЬНИК · ВЕРХ A (…)')).toBe(1)
  })

  it('распознаёт ЧЕТВЕРГ → 4', () => {
    expect(parseWeekday('ДЕНЬ 3 — ЧЕТВЕРГ · something')).toBe(4)
  })

  it('распознаёт ПЯТНИЦА → 5', () => {
    expect(parseWeekday('ДЕНЬ 4 — ПЯТНИЦА · something')).toBe(5)
  })

  it('возвращает null когда день недели не найден', () => {
    expect(parseWeekday('нет дня')).toBeNull()
  })
})
