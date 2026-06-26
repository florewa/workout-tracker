import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '~~/server/db/client'
import { exercises } from '~~/server/db/schema'

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
}

async function main() {
  const all = await db.select().from(exercises)
  // группируем по нормализованному имени
  const groups = new Map<string, { id: number }[]>()
  for (const ex of all) {
    const key = normalizeName(ex.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ id: ex.id })
  }
  let linked = 0
  for (const rows of groups.values()) {
    if (rows.length < 2) continue
    rows.sort((a, b) => a.id - b.id)
    const canonicalId = rows[0].id
    for (const dup of rows.slice(1)) {
      await db.update(exercises).set({ aliasOf: canonicalId }).where(eq(exercises.id, dup.id))
      linked++
    }
  }
  console.log(`Каноникализация: связано дублей=${linked}`)
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/normalize-exercises.ts')
if (isMain) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
}
