<script setup lang="ts">
interface ProgramDay {
  id: number
  code: string
  title: string
  weekday: number | null
  order: number
}

interface ActiveWorkout {
  id: number
  date: string
  dayId: number | null
}

const api = useApi()
const session = useSessionStore()

// Today's ISO weekday: Mon=1 … Sun=7
const isoToday = ((new Date().getDay() + 6) % 7) + 1

// Fetch program days and active workout in parallel
const { data: days } = await useAsyncData(
  'program-days',
  () => api.get<ProgramDay[]>('/api/program/days'),
  { server: false },
)

const { data: active } = await useAsyncData(
  'active-workout',
  async () => {
    try {
      return await api.get<ActiveWorkout | null>('/api/workouts/active')
    } catch {
      return null
    }
  },
  { server: false },
)

// Photo map: code → image path
const PHOTO_MAP: Record<string, string> = {
  'Верх A': '/programs/upper-a.jpg',
  'Низ A':  '/programs/lower-a.jpg',
  'Верх B': '/programs/upper-b.jpg',
  'Низ B':  '/programs/lower-b.jpg',
}

function dayFocus(title: string): string {
  const m = title.match(/\(([^)]+)\)/)
  return m ? m[1].trim() : ''
}

// Derived state
const activeDay = computed<ProgramDay | null>(() => {
  if (!active.value?.id) return null
  const dayId = active.value.dayId
  if (dayId == null) return null
  return days.value?.find(d => d.id === dayId) ?? null
})

const planned = computed<ProgramDay | null>(() =>
  days.value?.find(d => d.weekday === isoToday) ?? null,
)

// The card day: active state uses activeDay, planned state uses planned
const cardDay = computed<ProgramDay | null>(() => {
  if (active.value?.id) return activeDay.value
  return planned.value
})

const heroPhoto = computed<string | null>(() =>
  cardDay.value ? (PHOTO_MAP[cardDay.value.code] ?? null) : null,
)

// Exercise count for the card day (states A & B)
const exCount = ref<number | null>(null)
watch(
  cardDay,
  async (d) => {
    if (!d) { exCount.value = null; return }
    try {
      const res = await api.get<{ exercises: unknown[] }>('/api/program/days/' + encodeURIComponent(d.code))
      exCount.value = res.exercises.length
    } catch {
      exCount.value = null
    }
  },
  { immediate: true },
)

// State discriminant
const state = computed<'active' | 'planned' | 'rest'>(() => {
  if (active.value?.id) return 'active'
  if (planned.value) return 'planned'
  return 'rest'
})

// Headings per state
const stateHeading = computed(() => {
  if (state.value === 'active') return 'Тренировка идёт'
  if (state.value === 'planned') return 'Сегодня по плану'
  return 'Сегодня по плану отдых'
})

function startWorkout() {
  if (planned.value) {
    session.setMembers(session.currentUser ? [session.currentUser.id] : [])
    navigateTo('/start?dayId=' + planned.value.id)
  }
}

function continueWorkout() {
  if (active.value?.id) {
    navigateTo('/workout/' + active.value.id)
  }
}
</script>

<template>
  <section class="page">

    <!-- ── STATE A & B: heading above card ── -->
    <template v-if="state === 'active' || state === 'planned'">
      <!-- Section heading — on the page background, NOT over the photo -->
      <h1 class="section-heading">{{ stateHeading }}</h1>

      <!-- Photo card -->
      <div class="hero" :class="{ 'hero--photo': heroPhoto }">
        <!-- Photo background -->
        <img v-if="heroPhoto" :src="heroPhoto" class="hero-bg" alt="" aria-hidden="true" />
        <!-- Fallback background icon -->
        <div v-else class="hero-fallback-bg" aria-hidden="true">
          <Icon name="lucide:dumbbell" class="fallback-icon" />
        </div>

        <!-- Gradient overlay -->
        <div class="hero-overlay" aria-hidden="true" />

        <!-- Card content: day code + focus + meta only (no section heading here) -->
        <div class="hero-content">
          <h2 class="hero-code">
            {{ cardDay ? cardDay.code : 'Тренировка' }}
          </h2>
          <p v-if="cardDay && dayFocus(cardDay.title)" class="hero-focus">
            {{ dayFocus(cardDay.title) }}
          </p>
          <p v-if="exCount !== null" class="hero-meta">{{ exCount }} упражнений</p>
        </div>
      </div>

      <!-- CTAs -->
      <div class="ctas">
        <!-- State A: active workout -->
        <template v-if="state === 'active'">
          <AppButton icon="lucide:play" variant="accent" @click="continueWorkout">
            Продолжить
          </AppButton>
        </template>

        <!-- State B: planned day, no active -->
        <template v-else>
          <AppButton icon="lucide:play" variant="accent" @click="startWorkout">
            Начать
          </AppButton>
          <AppButton variant="ghost" @click="navigateTo('/select')">
            Выбрать другую
          </AppButton>
        </template>
      </div>
    </template>

    <!-- ── STATE C: rest day ── -->
    <template v-else>
      <h1 class="section-heading">{{ stateHeading }}</h1>

      <div class="rest">
        <div class="rest-icon-wrap" aria-hidden="true">
          <Icon name="lucide:moon" class="rest-icon" />
        </div>
        <p class="rest-sub">Можно выбрать тренировку вручную</p>
      </div>

      <div class="ctas">
        <AppButton variant="accent" @click="navigateTo('/select')">
          Выбрать тренировку
        </AppButton>
      </div>
    </template>

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

/* ── Section heading — lives on the page background ── */
.section-heading {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 30px);
  line-height: 1.15;
  color: var(--text);
}

/* ── Hero photo card ── */
.hero {
  position: relative;
  border-radius: var(--radius-lg);
  min-height: 260px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: var(--surface-2);
}

.hero-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.hero-fallback-bg {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--surface-2);
}

.fallback-icon {
  font-size: 56px;
  color: var(--muted);
  opacity: 0.35;
}

/* Dark gradient overlay — ensures text legible in both light and dark themes */
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.78) 0%,
    rgba(0, 0, 0, 0.46) 50%,
    rgba(0, 0, 0, 0.18) 100%
  );
}

.hero:not(.hero--photo) .hero-overlay {
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.55) 0%,
    rgba(0, 0, 0, 0.22) 60%,
    transparent 100%
  );
}

.hero-content {
  position: relative;
  z-index: 1;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Big day code — the only heading element inside the card */
.hero-code {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(34px, 11vw, 46px);
  line-height: 1;
  color: #fff;
}

.hero-focus {
  margin: 0;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.82);
}

.hero-meta {
  margin: 0;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1;
}

/* ── Rest day card ── */
.rest {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-8) var(--space-4);
  gap: var(--space-3);
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--divider);
}

.rest-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--surface-2);
  display: grid;
  place-items: center;
}

.rest-icon {
  font-size: 28px;
  color: var(--muted);
}

.rest-sub {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
}

/* ── CTAs ── */
.ctas {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (prefers-reduced-motion: reduce) {
  .hero-bg {
    transition: none;
  }
}
</style>
