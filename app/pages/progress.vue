<script setup lang="ts">
type PeriodKey = '1m' | '3m' | '6m' | '1y' | 'all'

interface Series { userId: number; baseline: number; points: { date: string; e1rm: number }[] }
interface BoardRow { userId: number; startE1rm: number; currentE1rm: number; deltaKg: number; deltaPct: number }
interface CompetitionPayload {
  period: { key: PeriodKey; label: string; start: string }
  participants: { id: number; name: string }[]
  exercises: { exerciseId: number; name: string }[]
  byExercise: Record<number, { series: Series[]; leaderboard: BoardRow[] }>
  rankings: {
    growth: { userId: number; deltaPct: number }[]
    consistency: { userId: number; sessions: number }[]
    records: { userId: number; count: number }[]
    heaviest: { userId: number; e1rm: number; exerciseName: string }[]
    tonnage: { userId: number; value: number }[]
  }
}

const api = useApi()

const PERIODS: { key: PeriodKey; short: string }[] = [
  { key: '1m', short: 'Мес' }, { key: '3m', short: '3 мес' }, { key: '6m', short: 'Полгода' },
  { key: '1y', short: 'Год' }, { key: 'all', short: 'Всё' },
]
const PALETTE = ['#ff7a1a', '#34c759', '#3b9dff', '#c86bff', '#ffd23f', '#ff5d8f']

const period = ref<PeriodKey>('3m')
const sortBy = ref<'pct' | 'kg'>('pct')
const infoOpen = ref(false)

const { data, pending } = await useAsyncData(
  'competition',
  () => api.get<CompetitionPayload>('/api/progress/competition', { period: period.value }),
  { server: false, watch: [period] },
)

const exercises = computed(() => data.value?.exercises ?? [])
const selectedExerciseId = ref<number | null>(null)
watch(
  exercises,
  (list) => {
    if (!list.length) { selectedExerciseId.value = null; return }
    if (!list.some(e => e.exerciseId === selectedExerciseId.value)) selectedExerciseId.value = list[0].exerciseId
  },
  { immediate: true },
)

function pName(id: number): string {
  return data.value?.participants.find(p => p.id === id)?.name ?? ''
}
function pColor(id: number): string {
  const idx = data.value?.participants.findIndex(p => p.id === id) ?? 0
  return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length]
}

const block = computed(() =>
  selectedExerciseId.value != null ? data.value?.byExercise[selectedExerciseId.value] ?? null : null,
)

const board = computed<BoardRow[]>(() => {
  const arr = [...(block.value?.leaderboard ?? [])]
  arr.sort((a, b) => (sortBy.value === 'kg' ? b.deltaKg - a.deltaKg : b.deltaPct - a.deltaPct))
  return arr
})

// «Гонка роста»: линии стартуют из 100% (baseline), ось X — время
const race = computed(() => {
  const b = block.value
  if (!b || !b.series.length || !data.value) return null
  const startT = Date.parse(data.value.period.start)
  let xMin = startT
  let xMax = startT
  const lines = b.series.map((s) => {
    const pts = [{ t: startT, pct: 100 }]
    for (const p of s.points) {
      const t = Date.parse(p.date)
      pts.push({ t, pct: s.baseline > 0 ? (p.e1rm / s.baseline) * 100 : 100 })
      if (t > xMax) xMax = t
    }
    return { userId: s.userId, pts }
  })
  if (xMax <= xMin) xMax = xMin + 86400000
  let yMin = Infinity
  let yMax = -Infinity
  for (const l of lines) for (const p of l.pts) { yMin = Math.min(yMin, p.pct); yMax = Math.max(yMax, p.pct) }
  const span = (yMax - yMin) || 1
  yMin -= span * 0.12
  yMax += span * 0.12
  const W = 100, H = 60, pad = 2
  const polylines = lines.map(l => ({
    userId: l.userId,
    points: l.pts.map((p) => {
      const x = ((p.t - xMin) / (xMax - xMin)) * W
      const y = pad + (1 - (p.pct - yMin) / (yMax - yMin)) * (H - 2 * pad)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' '),
  }))
  // линия 100% (старт) для ориентира
  const baseY = pad + (1 - (100 - yMin) / (yMax - yMin)) * (H - 2 * pad)
  return { polylines, baseY }
})

const tiles = computed(() => {
  const r = data.value?.rankings
  if (!r) return []
  const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v}%`
  return [
    { key: 'growth', icon: 'lucide:trophy', title: 'Главный рост', rows: r.growth.map(x => ({ userId: x.userId, val: fmtPct(x.deltaPct) })) },
    { key: 'records', icon: 'lucide:medal', title: 'Рекордсмен', rows: r.records.map(x => ({ userId: x.userId, val: `${x.count} PR` })) },
    { key: 'consistency', icon: 'lucide:target', title: 'Стабильность', rows: r.consistency.map(x => ({ userId: x.userId, val: `${x.sessions} трен.` })) },
    { key: 'heaviest', icon: 'lucide:dumbbell', title: 'Тяжеловес', rows: r.heaviest.map(x => ({ userId: x.userId, val: `${x.e1rm} кг`, sub: x.exerciseName })) },
    { key: 'tonnage', icon: 'lucide:package', title: 'Тоннаж', rows: r.tonnage.map(x => ({ userId: x.userId, val: `${Math.round(x.value)} кг` })) },
  ].filter(t => t.rows.length)
})

const hasData = computed(() => (data.value?.exercises.length ?? 0) > 0)
const medals = ['🥇', '🥈', '🥉']
</script>

<template>
  <section class="page">
    <header class="head">
      <div class="head-row">
        <h1 class="screen-title">Соревнование</h1>
        <button type="button" class="info-btn" aria-label="Пояснения" @click="infoOpen = true">
          <Icon name="lucide:info" />
        </button>
      </div>
      <p class="subtitle">Кто быстрее растёт — у каждого свой старт</p>

      <div class="seg">
        <button
          v-for="p in PERIODS"
          :key="p.key"
          type="button"
          class="seg-btn"
          :class="{ active: period === p.key }"
          @click="period = p.key"
        >
          {{ p.short }}
        </button>
      </div>
    </header>

    <div class="scroll">
      <template v-if="hasData">
        <!-- Селектор упражнения -->
        <div class="ex-strip">
          <button
            v-for="ex in exercises"
            :key="ex.exerciseId"
            type="button"
            class="ex-pill"
            :class="{ active: selectedExerciseId === ex.exerciseId }"
            @click="selectedExerciseId = ex.exerciseId"
          >
            {{ ex.name }}
          </button>
        </div>

        <!-- Гонка роста -->
        <div v-if="race" class="card glass">
          <div class="card-head">
            <span class="card-title">Гонка роста</span>
            <span class="card-note">старт = 100%</span>
          </div>
          <svg class="race" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" :y1="race.baseY" x2="100" :y2="race.baseY" class="race-base" vector-effect="non-scaling-stroke" />
            <polyline
              v-for="pl in race.polylines"
              :key="pl.userId"
              :points="pl.points"
              fill="none"
              :stroke="pColor(pl.userId)"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        </div>

        <!-- Лидерборд по упражнению -->
        <div class="card glass">
          <div class="card-head">
            <span class="card-title">Рост в этом упражнении</span>
            <div class="sort">
              <button type="button" :class="{ active: sortBy === 'pct' }" @click="sortBy = 'pct'">%</button>
              <button type="button" :class="{ active: sortBy === 'kg' }" @click="sortBy = 'kg'">кг</button>
            </div>
          </div>
          <div v-if="board.length" class="board">
            <div v-for="(row, i) in board" :key="row.userId" class="board-row">
              <span class="rank">{{ medals[i] ?? i + 1 }}</span>
              <span class="dot" :style="{ background: pColor(row.userId) }" />
              <span class="b-name">{{ pName(row.userId) }}</span>
              <span class="b-e1rm">{{ row.startE1rm }} → {{ row.currentE1rm }}</span>
              <span class="b-delta" :class="{ up: row.deltaKg > 0, down: row.deltaKg < 0 }">
                {{ row.deltaKg > 0 ? '+' : '' }}{{ row.deltaKg }} кг
                <em>{{ row.deltaPct > 0 ? '+' : '' }}{{ row.deltaPct }}%</em>
              </span>
            </div>
          </div>
          <p v-else class="card-empty">Нет данных за период</p>
        </div>

        <!-- Плитки-рейтинги -->
        <div class="tiles">
          <div v-for="t in tiles" :key="t.key" class="tile glass">
            <div class="tile-head">
              <Icon :name="t.icon" class="tile-icon" />
              <span class="tile-title">{{ t.title }}</span>
            </div>
            <div class="tile-rows">
              <div v-for="(row, i) in t.rows" :key="row.userId" class="tile-row">
                <span class="rank">{{ medals[i] ?? i + 1 }}</span>
                <span class="dot" :style="{ background: pColor(row.userId) }" />
                <span class="t-name">{{ pName(row.userId) }}</span>
                <span class="t-val">{{ row.val }}<em v-if="row.sub"> · {{ row.sub }}</em></span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="!pending" class="empty glass">
        <Icon name="lucide:trophy" class="empty-icon" aria-hidden="true" />
        <p class="empty-text">Запишите тренировки — здесь появится соревнование по росту в кругу друзей</p>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="infoOpen" class="modal-backdrop" @click.self="infoOpen = false">
          <div class="modal glass">
            <div class="modal-head">
              <h2 class="modal-title">Как читать</h2>
              <button type="button" class="modal-close" aria-label="Закрыть" @click="infoOpen = false">
                <Icon name="lucide:x" />
              </button>
            </div>
            <div class="modal-body">
              <div class="term">
                <span class="term-name">Гонка роста</span>
                <p class="term-desc">
                  У каждого свой стартовый вес, поэтому начало периода = <b>100%</b> для всех.
                  Линии расходятся по мере роста — видно, кто прибавляет быстрее, независимо от
                  абсолютных весов.
                </p>
              </div>
              <div class="term">
                <span class="term-name">e1RM</span>
                <p class="term-desc">
                  Оценочный разовый максимум: <b>вес × (1 + повторы / 30)</b>. Удобно сравнивать,
                  когда меняются и вес, и повторы.
                </p>
              </div>
              <div class="term">
                <span class="term-name">Δкг / Δ%</span>
                <p class="term-desc">
                  Насколько вырос e1RM за выбранный период — в килограммах и в процентах от старта.
                  Переключатель «% / кг» меняет сортировку лидерборда.
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
  height: 100%;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow: hidden;
}

.head { display: flex; flex-direction: column; gap: var(--space-2); flex-shrink: 0; }
.head-row { display: flex; align-items: center; gap: var(--space-2); }

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

.seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.seg-btn {
  flex: 1;
  min-height: 34px;
  border: 0;
  border-radius: calc(var(--radius-md) - 4px);
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &.active { background: var(--accent); color: var(--accent-text); }
}

.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ex-strip {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.ex-pill {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-edge-flat);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  &.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.card-title { font-size: 15px; font-weight: 700; color: var(--text); }
.card-note { font-size: 12px; color: var(--muted); }
.card-empty { margin: 0; font-size: 14px; color: var(--muted); }

.race { width: 100%; height: 140px; display: block; }
.race-base { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.4; }

.sort {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: var(--surface-2);

  button {
    min-width: 34px;
    height: 26px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    &.active { background: var(--accent); color: var(--accent-text); }
  }
}

.board { display: flex; flex-direction: column; gap: var(--space-2); }

.board-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.rank { width: 20px; flex-shrink: 0; text-align: center; font-size: 13px; font-weight: 700; color: var(--muted); }
.dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

.b-name { flex: 1; font-size: 14px; font-weight: 600; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.b-e1rm { font-size: 12px; color: var(--muted); flex-shrink: 0; }

.b-delta {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  text-align: right;
  min-width: 76px;

  em { display: block; font-style: normal; font-size: 11px; font-weight: 600; }
  &.up { color: var(--pr); }
  &.down { color: var(--accent); }
}

.tiles {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tile { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); }

.tile-head { display: flex; align-items: center; gap: var(--space-2); }
.tile-icon { font-size: 18px; color: var(--accent); }
.tile-title { font-size: 14px; font-weight: 700; color: var(--text); }

.tile-rows { display: flex; flex-direction: column; gap: var(--space-2); }

.tile-row { display: flex; align-items: center; gap: var(--space-2); }
.t-name { flex: 1; font-size: 14px; font-weight: 600; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-val {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  em { font-style: normal; font-weight: 600; font-size: 11px; color: var(--muted); }
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

.modal-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.modal-title { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 20px; color: var(--text); }

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

.modal-body { display: flex; flex-direction: column; gap: var(--space-4); }
.term { display: flex; flex-direction: column; gap: var(--space-1); }
.term-name { font-family: var(--font-display); font-weight: 800; font-size: 15px; color: var(--accent); }
.term-desc { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); b { color: var(--text); font-weight: 700; } }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform 0.2s ease; }
.modal-enter-from .modal, .modal-leave-to .modal { transform: scale(0.95); }
</style>
