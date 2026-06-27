<script setup lang="ts">
interface ProgressRow {
  exerciseId: number
  name: string
  startE1rm: number
  nowE1rm: number
  sessions: number
}

const api = useApi()
const { data: rows } = await useAsyncData(
  'progress',
  () => api.get<ProgressRow[]>('/api/progress'),
  { server: false },
)

function delta(r: ProgressRow): number {
  return Math.round((r.nowE1rm - r.startE1rm) * 10) / 10
}
function deltaPct(r: ProgressRow): number {
  return r.startE1rm > 0 ? Math.round(((r.nowE1rm - r.startE1rm) / r.startE1rm) * 100) : 0
}
function trend(r: ProgressRow): 'up' | 'down' | 'flat' {
  const d = delta(r)
  return d > 0 ? 'up' : d < 0 ? 'down' : 'flat'
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
          <span class="sessions">{{ r.sessions }} сесс.</span>
        </div>
        <div class="card-body">
          <div class="metric">
            <span class="metric-label">Старт</span>
            <span class="metric-val">{{ r.startE1rm }}</span>
          </div>
          <Icon name="lucide:move-right" class="arrow" />
          <div class="metric">
            <span class="metric-label">Сейчас</span>
            <span class="metric-val">{{ r.nowE1rm }}</span>
          </div>
          <span class="delta" :class="trend(r)">
            <Icon v-if="trend(r) === 'up'" name="lucide:trending-up" />
            <Icon v-else-if="trend(r) === 'down'" name="lucide:trending-down" />
            <Icon v-else name="lucide:minus" />
            {{ delta(r) > 0 ? '+' : '' }}{{ delta(r) }} ({{ deltaPct(r) > 0 ? '+' : '' }}{{ deltaPct(r) }}%)
          </span>
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

.ex-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.sessions {
  font-size: 12px;
  color: var(--muted);
  flex-shrink: 0;
}

.card-body {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.metric-val {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 26px;
  color: var(--text);
}

.arrow {
  font-size: 20px;
  color: var(--muted);
}

.delta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;

  &.up { color: var(--pr); }
  &.down { color: var(--accent); }
  &.flat { color: var(--muted); }
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
