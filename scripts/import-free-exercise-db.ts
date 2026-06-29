import 'dotenv/config'
import { eq, or, sql } from 'drizzle-orm'
import { db } from '~~/server/db/client'
import { exercises, categories } from '~~/server/db/schema'
import { MUSCLE_RU, EQUIPMENT_RU, CATEGORY_RU, NAME_RU } from '~~/scripts/exercise-i18n'

const SRC = 'free-exercise-db'
const DATA_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

interface Raw {
  name: string
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  category: string
  images: string[]
}

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

async function ensureCategories(executor: Executor): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  let order = 0
  for (const ru of Object.values(CATEGORY_RU)) {
    const [existing] = await executor.select({ id: categories.id }).from(categories).where(eq(categories.name, ru)).limit(1)
    if (existing) { map.set(ru, existing.id) }
    else {
      const [ins] = await executor.insert(categories).values({ name: ru, order: order++ }).returning({ id: categories.id })
      map.set(ru, ins.id)
    }
  }
  return map
}

async function main() {
  const res = await fetch(DATA_URL)
  if (!res.ok) throw new Error(`Не скачать датасет: ${res.status}`)
  const data = (await res.json()) as Raw[]

  const catMap = await ensureCategories(db)
  let created = 0
  let enriched = 0
  let skipped = 0

  for (const e of data) {
    const enName = e.name
    const ruName = NAME_RU[enName] ?? enName
    const muscleGroup = e.primaryMuscles.map(m => MUSCLE_RU[m] ?? m).filter(Boolean).join(', ') || null
    const fields = {
      nameEn: enName,
      imageUrl: e.images?.[0] ? IMG_BASE + e.images[0] : null,
      primaryMuscles: e.primaryMuscles,
      secondaryMuscles: e.secondaryMuscles,
      muscleGroup,
      equipment: (e.equipment && EQUIPMENT_RU[e.equipment]) || null,
      categoryId: catMap.get(CATEGORY_RU[e.category]) ?? null,
      instructions: e.instructions?.join('\n') || null,
      source: SRC,
    }

    // ищем по англ. имени (наш маркер импорта) или по совпадению русского названия
    const [found] = await db.select({ id: exercises.id, source: exercises.source })
      .from(exercises)
      .where(or(eq(exercises.nameEn, enName), eq(exercises.name, ruName)))
      .limit(1)

    if (found) {
      // обогащаем существующее (имя не трогаем — у наших оно уже на русском)
      await db.update(exercises).set(fields).where(eq(exercises.id, found.id))
      enriched++
      continue
    }
    try {
      await db.insert(exercises).values({ name: ruName, ...fields })
      created++
    } catch (err) {
      if ((err as { code?: string }).code === '23505') { skipped++; continue } // имя уже занято
      throw err
    }
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(exercises)
  console.log(`Импорт банка: создано=${created}, обогащено=${enriched}, пропущено(дубли)=${skipped}; всего упражнений в БД=${total}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
