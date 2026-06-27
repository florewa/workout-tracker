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

const infoOpen = ref(false)

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
      <div class="head-row">
        <h1 class="screen-title">Прогресс</h1>
        <button type="button" class="info-btn" aria-label="Что такое e1RM и PR" @click="infoOpen = true">
          <Icon name="lucide:info" />
        </button>
      </div>
      <p class="subtitle">Рост по упражнениям в e1RM</p>
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

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="infoOpen" class="modal-backdrop" @click.self="infoOpen = false">
          <div class="modal glass">
            <div class="modal-head">
              <h2 class="modal-title">Обозначения</h2>
              <button type="button" class="modal-close" aria-label="Закрыть" @click="infoOpen = false">
                <Icon name="lucide:x" />
              </button>
            </div>
            <div class="modal-body">
              <div class="term">
                <span class="term-name">e1RM</span>
                <p class="term-desc">
                  Оценочный разовый максимум (кг) — сколько ты поднял бы на один раз.
                  Считается из рабочего подхода: <b>вес × (1 + повторы / 30)</b>.
                  Например, 60 × 10 ≈ 80 кг. Удобно сравнивать прогресс, когда меняются
                  и вес, и повторы. Это оценка — на больших повторах (12+) завышает.
                </p>
              </div>
              <div class="term">
                <span class="term-name">PR</span>
                <p class="term-desc">
                  Personal record — твой лучший e1RM за всё время по этому упражнению.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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

.head-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.info-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;

  &:active { color: var(--text); }
}

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

/* Info modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.55);
}

.modal {
  width: 100%;
  max-width: 420px;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.modal-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 20px;
  color: var(--text);
}

.modal-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;

  &:active { color: var(--text); }
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.term {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.term-name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 15px;
  color: var(--accent);
}

.term-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
  b { color: var(--text); font-weight: 700; }
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-active .modal,
.modal-leave-active .modal { transition: transform 0.2s ease; }
.modal-enter-from .modal,
.modal-leave-to .modal { transform: scale(0.95); }
</style>
