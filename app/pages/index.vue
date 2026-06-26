<script setup lang="ts">
interface ProgramDay { id: number; code: string; title: string; order: number }

const api = useApi()
const session = useSessionStore()
const { data: days } = await useAsyncData('program-days', () => api.get<ProgramDay[]>('/api/program/days'), { server: false })
const selected = ref<ProgramDay | null>(null)
watchEffect(() => { if (days.value?.length && !selected.value) selected.value = days.value[0] })

const count = ref<number | null>(null)
watch(selected, async (d) => {
  if (!d) { count.value = null; return }
  try {
    const res = await api.get<{ exercises: unknown[] }>('/api/program/days/' + encodeURIComponent(d.code))
    count.value = res.exercises.length
  } catch {
    count.value = null
  }
}, { immediate: true })

function dayFocus(title: string): string {
  const m = title.match(/\(([^)]+)\)/)
  return (m ? m[1] : title.replace(/^ДЕНЬ\s*\d+\s*[—-].*?·\s*/u, '')).trim() || title
}

function cellFocus(title: string): string {
  const m = title.match(/\(([^)]+)\)/)
  const raw = (m ? m[1] : title).split(',')[0]
  return raw.replace(/\s*\+\s*/g, ' · ').replace(/·.*(сил|масс).*/i, '').trim()
}

function start() {
  if (session.currentUser) session.setMembers([session.currentUser.id])
  if (selected.value) navigateTo({ path: '/start', query: { dayId: selected.value.id } })
  else navigateTo('/start')
}

// Eyebrow — computed once at runtime
const eyebrow = (() => {
  const now = new Date()
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(now).replace(/\./g, '').toUpperCase()
  const dt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(now)
  return `${wd} · ${dt}`
})()

// Labeled axis matrix — look up the 4 known codes directly
const COLS = [
  { code: 'A', sub: 'сила' },
  { code: 'B', sub: 'масса' },
]
const ROW_LABELS = ['Верх', 'Низ']

const matrixInfo = computed(() => {
  if (!days.value?.length) return null
  const map = new Map(days.value.map(d => [d.code, d]))
  const rows = ROW_LABELS.map(part => ({
    label: part,
    cells: COLS.map(col => map.get(`${part} ${col.code}`) ?? null),
  }))
  if (rows.some(r => r.cells.some(c => c === null))) return null
  return { rows: rows as { label: string; cells: ProgramDay[] }[] }
})

const metaMins = computed(() => {
  if (count.value === null) return null
  return Math.round((count.value * 10) / 5) * 5
})
</script>

<template>
  <section class="page">
    <!-- Eyebrow -->
    <p class="eyebrow">{{ eyebrow }}</p>

    <!-- Day matrix -->
    <div v-if="days?.length" class="matrix-wrap">
      <!-- Labeled axis grid -->
      <div v-if="matrixInfo" class="matrix" role="group" aria-label="Выберите день">
        <!-- Header row: corner + column headers -->
        <div class="axis-corner" aria-hidden="true"></div>
        <div v-for="col in COLS" :key="col.code" class="axis-col" aria-hidden="true">
          <span class="axis-main">{{ col.code }}</span>
          <span class="axis-sub">{{ col.sub }}</span>
        </div>
        <!-- Data rows -->
        <template v-for="row in matrixInfo.rows" :key="row.label">
          <div class="axis-row" aria-hidden="true">{{ row.label }}</div>
          <button
            v-for="day in row.cells"
            :key="day.id"
            class="cell"
            :class="{ 'cell--on': selected?.id === day.id }"
            :aria-pressed="selected?.id === day.id"
            @click="selected = day"
          >
            <span class="cell-focus">{{ cellFocus(day.title) }}</span>
          </button>
        </template>
      </div>
      <!-- Fallback: flex wrap (non-standard program structure) -->
      <div v-else class="matrix-fallback">
        <button
          v-for="d in days"
          :key="d.id"
          class="cell cell--fallback"
          :class="{ 'cell--on': selected?.id === d.id }"
          :aria-pressed="selected?.id === d.id"
          @click="selected = d"
        >
          <span class="cell-code">{{ d.code }}</span>
          <span class="cell-focus">{{ cellFocus(d.title) }}</span>
        </button>
      </div>
    </div>

    <!-- Hero day card -->
    <Transition name="hero" mode="out-in">
      <div v-if="selected" :key="selected.code" class="hero">
        <div class="hero-code">{{ selected.code }}</div>
        <div class="hero-focus">{{ dayFocus(selected.title) }}</div>
        <template v-if="count !== null">
          <hr class="hero-divider" />
          <p class="hero-meta">{{ count }} УПР · ~{{ metaMins }} МИН</p>
        </template>
      </div>
    </Transition>

    <!-- CTA -->
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

/* Eyebrow */
.eyebrow {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Labeled matrix grid */
.matrix {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  gap: var(--space-2);
  align-items: center;
}

/* Corner spacer */
.axis-corner {
  /* intentionally empty */
}

/* Column header (A / B) */
.axis-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding-bottom: var(--space-1);
}

.axis-main {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  line-height: 1;
}

.axis-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--muted);
  opacity: 0.6;
  line-height: 1;
}

/* Row label (Верх / Низ) */
.axis-row {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--muted);
  white-space: nowrap;
  padding-right: var(--space-1);
  line-height: 1;
}

/* Cell */
.cell {
  min-height: 64px;
  border-radius: var(--radius-md);
  border: 1px solid var(--divider);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--space-2);
  user-select: none;
  transition: background 0.12s, color 0.12s, border-color 0.12s;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  &--on {
    background: var(--accent);
    color: var(--accent-text);
    border-color: transparent;
  }
}

.cell-focus {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
}

/* Fallback */
.matrix-fallback {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.cell--fallback {
  flex: 1 1 auto;
}

.cell-code {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.7;
}

/* Hero card */
.hero {
  position: relative;
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--accent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 12%, var(--surface)),
    var(--surface) 60%
  );
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.hero-code {
  font-family: var(--font-display);
  font-weight: 800;
  font-stretch: 125%;
  font-size: clamp(34px, 11vw, 46px);
  color: var(--accent);
  line-height: 1;
}

.hero-focus {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.4;
}

.hero-divider {
  margin: 0;
  border: none;
  border-top: 1px solid var(--divider);
}

.hero-meta {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

/* CTA */
.cta {
  margin-top: var(--space-2);
}

/* Hero cross-fade/slide transition */
@media (prefers-reduced-motion: no-preference) {
  .hero-enter-active,
  .hero-leave-active {
    transition: opacity 0.16s ease, transform 0.16s ease;
  }

  .hero-enter-from {
    opacity: 0;
    transform: translateY(6px);
  }

  .hero-leave-to {
    opacity: 0;
    transform: translateY(-6px);
  }
}
</style>
