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

// Check for an active workout first — redirect immediately if one exists
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

// Redirect straight into the recording screen (replace so home isn't in history)
if (active.value?.id) {
  await navigateTo('/workout/' + active.value.id, { replace: true })
}

// Only fetch program days when no redirect happened
const { data: days } = await useAsyncData(
  'program-days',
  () => api.get<ProgramDay[]>('/api/program/days'),
  { server: false },
)

const planned = computed<ProgramDay | null>(() =>
  days.value?.find(d => d.weekday === isoToday) ?? null,
)

const heroPhoto = computed<string | null>(() =>
  planned.value ? programPhoto(planned.value.code) : null,
)

// Exercise count for the planned day (state B)
const exCount = ref<number | null>(null)
watch(
  planned,
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

// State discriminant: active workouts redirect away, so only planned or rest remain
const state = computed<'planned' | 'rest'>(() => {
  if (planned.value) return 'planned'
  return 'rest'
})

const stateHeading = 'Сегодня по плану'

function startWorkout() {
  if (planned.value) {
    session.setMembers(session.currentUser ? [session.currentUser.id] : [])
    navigateTo('/start?dayId=' + planned.value.id)
  }
}

function goSelect() {
  navigateTo('/select')
}
</script>

<template>
  <section class="page">

    <!-- ── STATE B: planned day today ── -->
    <template v-if="state === 'planned'">
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

        <!-- Card content: day code + focus + meta -->
        <div class="hero-content">
          <h2 class="hero-code">
            {{ planned ? planned.code : 'Тренировка' }}
          </h2>
          <p v-if="planned && dayFocus(planned.title)" class="hero-focus">
            {{ dayFocus(planned.title) }}
          </p>
          <p v-if="exCount !== null" class="hero-meta">{{ exCount }} упражнений</p>
        </div>
      </div>

      <!-- CTAs -->
      <div class="ctas">
        <AppButton icon="lucide:play" variant="accent" @click="startWorkout">
          Начать
        </AppButton>
        <AppButton variant="ghost" @click="goSelect">
          Выбрать другую
        </AppButton>
      </div>
    </template>

    <!-- ── STATE C: rest day ── -->
    <template v-else>
      <h1 class="section-heading">{{ stateHeading }}</h1>

      <div class="rest-hero">
        <Icon name="lucide:moon" class="rest-moon" aria-hidden="true" />
        <div class="rest-content">
          <h2 class="rest-title">Отдых</h2>
          <p class="rest-focus">День восстановления</p>
          <p class="rest-hint">Можно выбрать тренировку вручную</p>
        </div>
      </div>

      <div class="ctas">
        <AppButton variant="accent" @click="goSelect">
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

/* ── Rest day card — mirrors the planned hero shape ── */
.rest-hero {
  position: relative;
  min-height: 260px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: var(--space-5);
  background: linear-gradient(160deg, var(--surface-2) 0%, var(--surface) 100%);
  border: 1px solid var(--glass-edge-flat);
  box-shadow: var(--glass-shadow);
}

/* Gradient glass edge where supported */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .rest-hero {
    border-color: transparent;
    background:
      linear-gradient(160deg, var(--surface-2) 0%, var(--surface) 100%) padding-box,
      var(--glass-edge) border-box;
  }
}

/* Large decorative moon bleeding off the top-right corner */
.rest-moon {
  position: absolute;
  top: -28px;
  right: -18px;
  font-size: 190px;
  color: var(--muted);
  opacity: 0.13;
  pointer-events: none;
}

.rest-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.rest-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(34px, 11vw, 46px);
  line-height: 1;
  color: var(--text);
}

.rest-focus {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
  color: var(--muted);
}

.rest-hint {
  margin: 0;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  opacity: 0.8;
  line-height: 1;
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
