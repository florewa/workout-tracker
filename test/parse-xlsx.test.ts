import { describe, it, expect, beforeAll } from 'vitest'
import type ExcelJS from 'exceljs'
import {
  loadWorkbook, parseReference, parseJournal, parseProgram,
} from '~/scripts/parse-xlsx'

const FILE = 'data/План тренировок.xlsx'
let wb: ExcelJS.Workbook

beforeAll(async () => {
  wb = await loadWorkbook(FILE)
})

describe('parseReference', () => {
  it('возвращает список упражнений и пользователей', () => {
    const ref = parseReference(wb)
    expect(ref.exercises).toContain('Жим штанги лёжа')
    expect(ref.exercises.length).toBeGreaterThan(20)
    expect(ref.users).toEqual(expect.arrayContaining(['Данил', 'Егор']))
  })
})

describe('parseJournal', () => {
  it('парсит строки журнала с датой, кто, упражнением, весом и повторами', () => {
    const rows = parseJournal(wb)
    expect(rows.length).toBeGreaterThan(50)
    const first = rows[0]
    expect(first.who).toBe('Егор')
    expect(first.exercise).toBe('Жим гантелей на наклонной 30°')
    expect(first.weight).toBe(24)
    expect(first.reps).toBe(10)
    expect(first.date).toBeInstanceOf(Date)
  })
})

describe('parseProgram', () => {
  it('парсит 4 дня программы с упражнениями', () => {
    const days = parseProgram(wb)
    expect(days.length).toBe(4)
    const day1 = days[0]
    expect(day1.exercises[0].name).toBe('Жим штанги лёжа')
    expect(day1.exercises[0].sets).toBe(5)
    expect(day1.exercises.length).toBeGreaterThan(5)
  })
})
