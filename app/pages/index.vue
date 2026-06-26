<script setup lang="ts">
interface ProgramDay {
  id: number
  code: string
  title: string
  weekday: number | null
  order: number
}

const api = useApi()
const session = useSessionStore()

// Today's ISO weekday: Mon=1 … Sun=7
const isoToday = ((new Date().getDay() + 6) % 7) + 1

const { data: days } = await useAsyncData(
  'program-days',
  () => api.get<ProgramDay[]>('/api/program/days'),
  { server: false },
)

const planned = computed(() => days.value?.find(d => d.weekday === isoToday) ?? null)

// Exercise count for the planned day
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

// Photo map: code → image path
const PHOTO_MAP: Record<string, string> = {
  'Верх A': '/programs/upper-a.jpg',
  'Низ A':  '/programs/lower-a.jpg',
  'Верх B': '/programs/upper-b.jpg',
  'Низ B':  '/programs/lower-b.jpg',
}

const heroPhoto = computed(() => (planned.value ? (PHOTO_MAP[planned.value.code] ?? null) : null))

function dayFocus(title: string): string {
  const m = title.match(/\(([^)]+)\)/)
  return m ? m[1].trim() : ''
}

function startWorkout() {
  if (planned.value) {
    session.setMembers(session.currentUser ? [session.currentUser.id] : [])
    navigateTo('/start?dayId=' + planned.value.id)
  }
}
</script>

<template>
  <section class="page">
    <!-- ── PLANNED DAY ── -->
    <template v-if="planned">
      <!-- Hero card with photo -->
      <div class="hero" :class="{ 'hero--photo': heroPhoto }">
        <!-- Photo background -->
        <img v-if="heroPhoto" :src="heroPhoto" class="hero-bg" alt="" aria-hidden="true" />
        <!-- Fallback background icon -->
        <div v-else class="hero-fallback-bg" aria-hidden="true">
          <Icon name="lucide:dumbbell" class="fallback-icon" />
        </div>

        <!-- Gradient overlay -->
        <div class="hero-overlay" aria-hidden="true" />

        <!-- Content -->
        <div class="hero-content">
          <p class="hero-eyebrow">
            <Icon name="lucide:calendar" class="eyebrow-icon" aria-hidden="true" />
            Сегодня по плану
          </p>
          <h1 class="hero-code">{{ planned.code }}</h1>
          <p v-if="dayFocus(planned.title)" class="hero-focus">{{ dayFocus(planned.title) }}</p>
          <p v-if="exCount !== null" class="hero-meta">{{ exCount }} упражнений</p>
        </div>
      </div>

      <!-- CTAs -->
      <div class="ctas">
        <AppButton icon="lucide:play" variant="accent" @click="startWorkout">Начать</AppButton>
        <AppButton variant="ghost" @click="navigateTo('/select')">Выбрать другую</AppButton>
      </div>
    </template>

    <!-- ── REST DAY ── -->
    <template v-else>
      <div class="rest">
        <div class="rest-icon-wrap" aria-hidden="true">
          <Icon name="lucide:moon" class="rest-icon" />
        </div>
        <h1 class="rest-heading">Сегодня по плану отдых</h1>
        <p class="rest-sub">Можно выбрать тренировку вручную</p>
      </div>

      <div class="ctas">
        <AppButton variant="accent" @click="navigateTo('/select')">Выбрать тренировку</AppButton>
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

/* ── Hero ── */
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

/* Dark gradient overlay — must keep text legible in both light and dark themes */
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

/* When there's a photo, overlay is already visible; fallback-only gets a lighter treatment */
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

.hero-eyebrow {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-body, 'Manrope', sans-serif);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1;
}

.eyebrow-icon {
  font-size: 13px;
  flex-shrink: 0;
}

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

/* ── Rest day ── */
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

.rest-heading {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 28px);
  line-height: 1.2;
  color: var(--text);
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

/* Reduced-motion: no hero transitions needed (no animation added) */
@media (prefers-reduced-motion: reduce) {
  .hero-bg {
    transition: none;
  }
}
</style>
