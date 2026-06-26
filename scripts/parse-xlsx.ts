import ExcelJS from 'exceljs'

export interface JournalRow {
  date: Date
  who: string
  exercise: string
  weight: number
  reps: number
}

export interface ProgramExerciseRow {
  order: number
  name: string
  group: string | null
  sets: number | null
  reps: string | null
  tempo: string | null
  rest: number | null
}

export interface ProgramDay {
  code: string
  title: string
  order: number
  exercises: ProgramExerciseRow[]
}

export async function loadWorkbook(path: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  return wb
}

function text(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim()
  return String(value).trim()
}

function num(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'boolean') return null
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function parseReference(wb: ExcelJS.Workbook): { exercises: string[]; users: string[] } {
  const ws = wb.getWorksheet('Справочники')
  if (!ws) throw new Error('Лист «Справочники» не найден')
  const exercises: string[] = []
  const users: string[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // заголовок
    const ex = text(row.getCell(1).value)
    const who = text(row.getCell(3).value)
    if (ex) exercises.push(ex)
    if (who) users.push(who)
  })
  return { exercises, users }
}

export function parseJournal(wb: ExcelJS.Workbook): JournalRow[] {
  const ws = wb.getWorksheet('Журнал')
  if (!ws) throw new Error('Лист «Журнал» не найден')
  const rows: JournalRow[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // заголовок
    const dateVal = row.getCell(1).value
    const who = text(row.getCell(2).value)
    const exercise = text(row.getCell(3).value)
    const weight = num(row.getCell(4).value)
    const reps = num(row.getCell(5).value)
    if (!who || !exercise || weight == null || reps == null) return
    const date = dateVal instanceof Date ? dateVal : new Date(text(dateVal))
    rows.push({ date, who, exercise, weight, reps })
  })
  return rows
}

const DAY_HEADER = /^ДЕНЬ\s+\d+/u
// из "... · ВЕРХ A (...)" достаём код "ВЕРХ A" -> нормализуем в "Верх A"
function parseDayCode(header: string): string {
  const match = header.match(/·\s*([А-ЯЁ]+)\s+([AB])/u)
  if (!match) return header.slice(0, 20)
  const word = match[1]
  const normalized = word.charAt(0) + word.slice(1).toLowerCase()
  return `${normalized} ${match[2]}`
}

export function parseProgram(wb: ExcelJS.Workbook): ProgramDay[] {
  const ws = wb.getWorksheet('План тренировок')
  if (!ws) throw new Error('Лист «План тренировок» не найден')
  const days: ProgramDay[] = []
  let current: ProgramDay | null = null

  ws.eachRow((row) => {
    const a = text(row.getCell(1).value)
    if (DAY_HEADER.test(a)) {
      current = {
        code: parseDayCode(a),
        title: a,
        order: days.length + 1,
        exercises: [],
      }
      days.push(current)
      return
    }
    if (!current) return
    if (a === '№' || a === '') return // заголовок колонок или пустая
    // строки упражнений: колонка A — порядковый номер (1,2,3…) или "П" (прехаб)
    // описания тренировки — объединённые ячейки с одинаковым текстом везде
    const isExerciseRow = /^\d+$/.test(a) || a === 'П'
    if (!isExerciseRow) return
    const name = text(row.getCell(2).value)
    if (!name) return
    current.exercises.push({
      order: current.exercises.length + 1,
      name,
      group: text(row.getCell(3).value) || null,
      sets: num(row.getCell(4).value),
      reps: text(row.getCell(5).value) || null,
      tempo: text(row.getCell(6).value) || null,
      rest: num(row.getCell(7).value),
    })
  })
  return days
}
