import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '~~/server/db/client'
import { programDays } from '~~/server/db/schema'

const WEEKDAY_MAP: Record<string, number> = {
  ПОНЕДЕЛЬНИК: 1,
  ВТОРНИК: 2,
  СРЕДА: 3,
  ЧЕТВЕРГ: 4,
  ПЯТНИЦА: 5,
  СУББОТА: 6,
  ВОСКРЕСЕНЬЕ: 7,
}

export function parseWeekday(title: string): number | null {
  const upper = title.toUpperCase()
  for (const [name, num] of Object.entries(WEEKDAY_MAP)) {
    if (upper.includes(name)) return num
  }
  return null
}

async function main() {
  const rows = await db.select({ id: programDays.id, title: programDays.title }).from(programDays)
  let updated = 0
  for (const row of rows) {
    const weekday = parseWeekday(row.title)
    if (weekday !== null) {
      await db.update(programDays).set({ weekday }).where(eq(programDays.id, row.id))
      updated++
    }
  }
  console.log(`Backfill complete: updated ${updated} of ${rows.length} rows`)
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/backfill-weekday.ts')
if (isMain) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
}
