<script setup lang="ts">
interface ProgressPoint { date: string; e1rm: number; volume: number }
interface ProgressRow {
  exerciseId: number
  name: string
  points: ProgressPoint[]
  best: number
  sessions: number
}

const api = useApi()
const { data: rows } = await useAsyncData(
  'progress',
  () => api.get<ProgressRow[]>('/api/progress'),
  { server: false },
)

const startVal = (r: ProgressRow) => r.points[0]?.e1rm ?? 0
const nowVal = (r: ProgressRow) => r.points[r.points.length - 1]?.e1rm ?? 0
const delta = (r: ProgressRow) => Math.round((nowVal(r) - startVal(r)) * 10) / 10
const deltaPct = (r: ProgressRow) =>
  startVal(r) > 0 ? Math.round(((nowVal(r) - startVal(r)) / startVal(r)) * 100) : 0
const trend = (r: ProgressRow): 'up' | 'down' | 'flat' =>
  delta(r) > 0 ? 'up' : delta(r) < 0 ? 'down' : 'flat'

function lastDate(r: ProgressRow): string {
  const d = r.points[r.points.length - 1]?.date
  return d ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(d)) : ''
}

// Спарклайн: e1RM по сессиям, нормированный в 100×32
function sparkPoints(r: ProgressRow): string {
  const es = r.points.map(p => p.e1rm)
  const n = es.length
  if (n <= 1) return '0,16 100,16'
  const min = Math.min(...es)
  const max = Math.max(...es)
  const span = max - min || 1
  const pad = 4
  return es
    .map((e, i) => {
      const x = (i / (n - 1)) * 100
      const y = pad + (1 - (e - min) / span) * (32 - 2 * pad)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
</script>

<template>
  <section class="page">
    <header class="head">
      <h1 class="screen-title">Прогресс</h1>
      <p class="subtitle">e1RM — оценка одноповторного максимума</p>
    </header>

    <div v-if="rows && rows.length" class="cards">
      <div v-for="r in rows" :key="r.exerciseId" class="card glass">
        <div class="card-top">
          <span class="ex-name">{{ r.name }}</span>
          <span class="pr">PR {{ r.best }}</span>
        </div>

        <div class="card-mid">
          <div class="now">
            <span class="now-val">{{ nowVal(r) }}</span>
            <span class="now-unit">кг e1RM</span>
          </div>
          <span class="delta" :class="trend(r)">
            <Icon v-if="trend(r) === 'up'" name="lucide:trending-up" />
            <Icon v-else-if="trend(r) === 'down'" name="lucide:trending-down" />
            <Icon v-else name="lucide:minus" />
            {{ delta(r) > 0 ? '+' : '' }}{{ delta(r) }} ({{ deltaPct(r) > 0 ? '+' : '' }}{{ deltaPct(r) }}%)
          </span>
        </div>

        <svg class="spark" :class="trend(r)" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
          <polyline :points="sparkPoints(r)" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>

        <div class="substats">
          <span>{{ r.sessions }} сесс.</span>
          <span>старт {{ startVal(r) }} → {{ nowVal(r) }}</span>
          <span>{{ lastDate(r) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty glass">
      <Icon name="lucide:trending-up" class="empty-icon" aria-hidden="true" />
      <p class="empty-text">Запиши пару тренировок — здесь появится рост по упражнениям</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.page {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 100%;
}

.head { display: flex; flex-direction: column; gap: var(--space-1); }

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 30px);
  line-height: 1.15;
  color: var(--text);
}

.subtitle { margin: 0; font-size: 14px; color: var(--muted); }

.cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
}

.card-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.ex-name { font-size: 16px; font-weight: 700; color: var(--text); }

.pr {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.card-mid {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.now { display: flex; align-items: baseline; gap: var(--space-2); }

.now-val {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 32px;
  color: var(--text);
  line-height: 1;
}

.now-unit { font-size: 12px; color: var(--muted); }

.delta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;

  &.up { color: var(--pr); }
  &.down { color: var(--accent); }
  &.flat { color: var(--muted); }
}

.spark {
  width: 100%;
  height: 36px;
  display: block;

  &.up { color: var(--pr); }
  &.down { color: var(--accent); }
  &.flat { color: var(--muted); }
}

.substats {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 12px;
  color: var(--muted);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.empty-icon { font-size: 36px; color: var(--muted); opacity: 0.6; }
.empty-text { margin: 0; font-size: 14px; color: var(--muted); line-height: 1.5; }
</style>
