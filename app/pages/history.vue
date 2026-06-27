<script setup lang="ts">
interface WorkoutRow {
  id: number
  date: string
  dayId: number | null
  dayCode: string | null
  finishedAt: string | null
  memberCount: number
  setCount: number
}

const api = useApi()
const { data: workouts } = await useAsyncData(
  'history',
  () => api.get<WorkoutRow[]>('/api/workouts'),
  { server: false },
)

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(iso))
}

function open(id: number) { navigateTo(`/workout/${id}`) }
</script>

<template>
  <section class="page">
    <header class="head">
      <h1 class="screen-title">История</h1>
    </header>

    <div class="scroll">
    <div v-if="workouts && workouts.length" class="list glass">
      <button v-for="w in workouts" :key="w.id" type="button" class="row" @click="open(w.id)">
        <div class="row-main">
          <span class="row-title">{{ w.dayCode ?? 'Тренировка' }}</span>
          <span class="row-date">{{ dateLabel(w.date) }}</span>
        </div>
        <div class="row-meta">
          <span class="row-sets">{{ w.setCount }} подх.</span>
          <Icon name="lucide:chevron-right" class="row-arrow" />
        </div>
      </button>
    </div>

    <div v-else class="empty glass">
      <Icon name="lucide:history" class="empty-icon" aria-hidden="true" />
      <p class="empty-text">Пока нет завершённых тренировок</p>
    </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.page {
  height: 100%;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow: hidden;
}

.head { flex-shrink: 0; }

.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 30px);
  line-height: 1.15;
  color: var(--text);
}

.list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;

  &:not(:last-child) { border-bottom: 1px solid var(--glass-edge-flat); }
  &:active { background: var(--surface-2); }
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
}

.row-date {
  font-size: 13px;
  color: var(--muted);
}

.row-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.row-sets {
  font-size: 13px;
  color: var(--muted);
}

.row-arrow {
  font-size: 18px;
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

.empty-icon {
  font-size: 36px;
  color: var(--muted);
  opacity: 0.6;
}

.empty-text {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}
</style>
