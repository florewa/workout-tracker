<script setup lang="ts">
interface ProgramDay { id: number; code: string; title: string; order: number }
interface ParsedDay extends ProgramDay { part: string; block: string }

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

// Day matrix — parse "Верх A" → { part: "Верх", block: "A" }
function parseCode(code: string): { part: string; block: string } | null {
  const m = code.match(/^(.+?)\s+([A-ZА-ЯA-Za-zа-я])$/u)
  if (!m) return null
  return { part: m[1], block: m[2].toUpperCase() }
}

const matrixInfo = computed(() => {
  if (!days.value?.length) return null
  const withParsed: ParsedDay[] = []
  for (const d of days.value) {
    const p = parseCode(d.code)
    if (!p) return null
    withParsed.push({ ...d, ...p })
  }
  const parts = [...new Set(withParsed.map(d => d.part))]
  const blocks = [...new Set(withParsed.map(d => d.block))]
  if (parts.length !== 2 || blocks.length !== 2) return null
  const map = new Map(withParsed.map(d => [`${d.part}|${d.block}`, d]))
  const grid: ParsedDay[][] = []
  for (const part of parts) {
    const row = blocks.map(b => map.get(`${part}|${b}`))
    if (row.some(c => !c)) return null
    grid.push(row as ParsedDay[])
  }
  return { grid }
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
      <!-- 2×2 grid -->
      <div v-if="matrixInfo" class="matrix" role="group" aria-label="Выберите день">
        <template v-for="(row, ri) in matrixInfo.grid" :key="ri">
          <button
            v-for="day in row"
            :key="day.id"
            class="cell"
            :class="{ 'cell--on': selected?.id === day.id }"
            :aria-pressed="selected?.id === day.id"
            @click="selected = day"
          >
            <span class="cell-part">{{ day.part }}</span><sup class="cell-block">{{ day.block }}</sup>
          </button>
        </template>
      </div>
      <!-- Fallback: flex wrap -->
      <div v-else class="matrix-fallback">
        <button
          v-for="d in days"
          :key="d.id"
          class="cell"
          :class="{ 'cell--on': selected?.id === d.id }"
          :aria-pressed="selected?.id === d.id"
          @click="selected = d"
        >
          {{ d.code }}
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

/* Matrix */
.matrix {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.matrix-fallback {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.cell {
  min-height: 64px;
  border-radius: var(--radius-md);
  border: 1px solid var(--divider);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 15px;
  font-weight: 600;
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

.cell-part {
  font-family: var(--font-display);
  font-weight: 700;
}

.cell-block {
  font-family: var(--font-mono);
  font-size: 0.65em;
  vertical-align: super;
  color: inherit;
  opacity: 0.8;
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
