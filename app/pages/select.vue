<script setup lang="ts">
interface ProgramDay {
  id: number
  code: string
  title: string
  order: number
  weekday: number | null
}

interface Workout {
  id: number
  date: string
  dayId: number | null
  memberCount: number
}

const api = useApi()
const session = useSessionStore()

function localIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

const todayIso = localIso(new Date())
const selectedDate = ref(todayIso)

// Header date in accent — recompute when selectedDate changes
const headerDate = computed(() => {
  // parse as noon local time to avoid UTC offset flipping the day
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
    new Date(selectedDate.value + 'T12:00:00'),
  )
})

// Fetch all data in one shot
const { data, status } = await useAsyncData(
  'select-screen',
  async () => {
    const [days, workouts] = await Promise.all([
      api.get<ProgramDay[]>('/api/program/days'),
      api.get<Workout[]>('/api/workouts'),
    ])

    const exerciseCounts = await Promise.all(
      days.map(d =>
        api
          .get<{ exercises: unknown[] }>('/api/program/days/' + encodeURIComponent(d.code))
          .then(r => ({ code: d.code, count: r.exercises.length }))
          .catch(() => ({ code: d.code, count: 0 })),
      ),
    )

    return { days, workouts, exerciseCounts }
  },
  { server: false },
)

const days = computed(() => data.value?.days ?? [])
const recentWorkouts = computed(() => (data.value?.workouts ?? []).slice(0, 3))

const countMap = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  for (const e of data.value?.exerciseCounts ?? []) m[e.code] = e.count
  return m
})

const dayCodeMap = computed<Record<number, string>>(() => {
  const m: Record<number, string> = {}
  for (const d of days.value) m[d.id] = d.code
  return m
})

// ISO weekday of today: Mon=1 … Sun=7
const todayIsoWeekday = (() => {
  const js = new Date().getDay()
  return js === 0 ? 7 : js
})()

function isFeatured(day: ProgramDay): boolean {
  return day.weekday === todayIsoWeekday
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(dateStr))
}

function selectDay(day: ProgramDay) {
  session.setMembers(session.currentUser ? [session.currentUser.id] : [])
  navigateTo(`/start?dayId=${day.id}&date=${selectedDate.value}`)
}
</script>

<template>
  <section class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-text">
        <h1 class="h1 page-title">Выбор тренировки</h1>
        <p class="subtitle">Выбери программу на сегодня</p>
      </div>
      <div class="header-date" aria-label="Текущая дата">
        <Icon name="lucide:calendar" class="calendar-icon" />
        <span class="date-label">{{ headerDate }}</span>
      </div>
    </div>

    <!-- Week strip -->
    <WeekStrip v-model="selectedDate" />

    <!-- My programs -->
    <div class="section-header">
      <h2 class="h2 section-title">Мои программы</h2>
      <span class="section-action" title="Скоро — редактор программ">＋ Новая программа</span>
    </div>

    <div v-if="status === 'pending'" class="skeleton-list" aria-busy="true">
      <div v-for="n in 4" :key="n" class="skeleton-card" />
    </div>

    <div v-else class="cards">
      <ProgramCard
        v-for="day in days"
        :key="day.id"
        :day="day"
        :count="countMap[day.code] ?? 0"
        :featured="isFeatured(day)"
        @select="selectDay(day)"
      />
    </div>

    <!-- Recent workouts -->
    <div class="section-header">
      <h2 class="h2 section-title">Недавние тренировки</h2>
      <span class="section-action" title="Скоро">Смотреть все</span>
    </div>

    <div v-if="recentWorkouts.length" class="recent-list">
      <button
        v-for="w in recentWorkouts"
        :key="w.id"
        class="recent-row"
        @click="navigateTo('/workout/' + w.id)"
      >
        <span class="recent-badge" aria-hidden="true">
          <Icon name="lucide:dumbbell" class="badge-icon" />
        </span>
        <span class="recent-name">{{ w.dayId ? (dayCodeMap[w.dayId] ?? 'Тренировка') : 'Тренировка' }}</span>
        <span class="recent-date">{{ formatDate(w.date) }}</span>
        <Icon name="lucide:chevron-right" class="recent-chevron" aria-hidden="true" />
      </button>
    </div>

    <p v-else-if="status !== 'pending'" class="empty-recent">
      Пока нет тренировок — начни первую сегодня
    </p>
  </section>
</template>

<style scoped lang="scss">
.page {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Header ── */
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  color: var(--text);
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.4;
}

.header-date {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  padding-top: 5px;
  flex-shrink: 0;
}

.calendar-icon {
  font-size: 15px;
}

/* ── Section headers ── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.section-title {
  margin: 0;
  color: var(--text);
}

.section-action {
  font-size: 13px;
  color: var(--muted);
  cursor: default;
  user-select: none;
}

/* ── Program cards ── */
.cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Loading skeletons */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.skeleton-card {
  height: 122px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--divider);
  @media (prefers-reduced-motion: no-preference) {
    animation: pulse 1.4s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── Recent workouts ── */
.recent-list {
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.recent-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 56px;
  padding: var(--space-2) var(--space-4);
  border: none;
  border-bottom: 1px solid var(--divider);
  background: transparent;
  cursor: pointer;
  color: var(--text);
  text-align: left;

  &:last-child { border-bottom: none; }

  @media (prefers-reduced-motion: no-preference) {
    transition: background 0.1s;
  }

  @media (hover: hover) {
    &:hover { background: var(--surface-2); }
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
}

.recent-badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface-2);
  display: grid;
  place-items: center;
  color: var(--muted);
  flex-shrink: 0;
}

.badge-icon { font-size: 16px; }

.recent-name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
}

.recent-date {
  font-size: 13px;
  color: var(--muted);
  flex-shrink: 0;
}

.recent-chevron {
  font-size: 16px;
  color: var(--muted);
  flex-shrink: 0;
}

.empty-recent {
  margin: 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  padding: var(--space-5) 0;
}
</style>
