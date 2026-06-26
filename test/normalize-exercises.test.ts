import { describe, it, expect } from 'vitest'
import { normalizeName } from '~~/scripts/normalize-exercises'

describe('normalizeName', () => {
  it('схлопывает пробелы и регистр', () => {
    expect(normalizeName('  Жим  лёжа ')).toBe(normalizeName('жим лежа'))
  })
  it('унифицирует ё/е', () => {
    expect(normalizeName('Тяга нижнего блока')).toBe(normalizeName('Тяга нижнего блока'))
    expect(normalizeName('бабочка')).toBe('бабочка')
  })
  it('различает разные упражнения', () => {
    expect(normalizeName('Жим лёжа')).not.toBe(normalizeName('Жим сидя'))
  })
})
