<script setup lang="ts">
interface ProgramDay { id: number; code: string; title: string; order: number }
interface DayDetail { day: ProgramDay; exercises: unknown[] }

const api = useApi()
const session = useSessionStore()
const { data: days } = await useAsyncData('program-days', () => api.get<ProgramDay[]>('/api/program/days'), { server: false })
const selected = ref<ProgramDay | null>(null)
watchEffect(() => { if (days.value?.length && !selected.value) selected.value = days.value[0] })

const exerciseCount = ref<number | null>(null)
watch(selected, async (day) => {
  if (!day) { exerciseCount.value = null; return }
  try {
    const detail = await api.get<DayDetail>(`/api/program/days/${encodeURIComponent(day.code)}`)
    exerciseCount.value = detail.exercises.length
  } catch {
    exerciseCount.value = null
  }
}, { immediate: true })

function dayFocus(title: string): string {
  const m = title.match(/\(([^)]+)\)/)
  if (m) return m[1]
  return title.replace(/^ДЕНЬ\s*\d+\s*[—-].*?·\s*/u, '').trim() || title
}

function start() {
  if (session.currentUser) session.setMembers([session.currentUser.id])
  if (selected.value) navigateTo({ path: '/start', query: { dayId: selected.value.id } })
  else navigateTo('/start')
}
</script>

<template>
  <section class="page">
    <h1 class="greet h1">Сегодня</h1>

    <div v-if="days?.length" class="pills">
      <AppChip
        v-for="d in days"
        :key="d.id"
        :active="selected?.id === d.id"
        class="pill"
        @click="selected = d"
      >
        {{ d.code }}
      </AppChip>
    </div>

    <AppCard v-if="selected" class="hero-card">
      <div class="hero-badge">
        <Icon name="lucide:flame" class="hero-icon" />
      </div>
      <div class="hero-code">{{ selected.code }}</div>
      <div class="hero-focus label">{{ dayFocus(selected.title) }}</div>
      <div v-if="exerciseCount !== null" class="hero-count label">
        {{ exerciseCount }} упражнений
      </div>
    </AppCard>

    <div class="cta">
      <AppButton icon="lucide:play" @click="start">Начать тренировку</AppButton>
    </div>
  </section>
</template>

<style scoped lang="scss">
.page {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.greet {
  margin: 0;
  color: var(--text);
}

/* Pills row */
.pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.pill {
  min-height: 44px;
  cursor: pointer;
  user-select: none;
}

/* Hero card */
.hero-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}

.hero-icon {
  font-size: 24px;
  color: var(--accent);
}

.hero-code {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--accent);
}

.hero-focus {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.4;
}

.hero-count {
  color: var(--muted);
  font-size: 13px;
}

.cta {
  margin-top: var(--space-2);
}
</style>
