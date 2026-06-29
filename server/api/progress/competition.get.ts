import { getQuery } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { competition, type PeriodKey } from '~~/server/services/competition'

const PERIODS: PeriodKey[] = ['1m', '3m', '6m', '1y', 'all']

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const q = getQuery(event)
  const key = String(q.period ?? '3m') as PeriodKey
  const period: PeriodKey = PERIODS.includes(key) ? key : '3m'
  return competition(db, me.id, period)
})
