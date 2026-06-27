<script setup lang="ts">
interface MemberLite { id: number; name: string }
interface DayExercise { id: number; name: string; order: number; targetSets: number | null; targetReps: string | null }
interface SetRow {
  id: number; userId: number; exerciseId: number; exerciseName: string
  setOrder: number; weight: number; reps: number; note: string | null
}
interface WorkoutData {
  workout: { id: number; date: string; dayId: number | null }
  members: MemberLite[]
  sets: SetRow[]
}
interface DayLite { id: number; code: string; title: string }
interface DayDetail { day: { id: number; code: string; title: string }; exercises: DayExercise[] }

const route = useRoute()
const api = useApi()
const session = useSessionStore()
const id = Number(route.params.id)

const { data, refresh } = await useAsyncData(
  `workout-${id}`,
  () => api.get<WorkoutData>(`/api/workouts/${id}`),
  { server: false },
)

const { data: daysList } = await useAsyncData(
  'program-days-lite',
  () => api.get<DayLite[]>('/api/program/days'),
  { server: false },
)

const dayCode = computed(() =>
  daysList.value?.find(d => d.id === data.value?.workout.dayId)?.code ?? null,
)

const { data: dayData } = await useAsyncData(
  'workout-day',
  () => (dayCode.value ? api.get<DayDetail>(`/api/program/days/${encodeURIComponent(dayCode.value)}`) : Promise.resolve(null)),
  { server: false, watch: [dayCode] },
)

const exercises = computed<DayExercise[]>(() => dayData.value?.exercises ?? [])
const dayTitle = computed(() => dayData.value?.day.code ?? 'Тренировка')

// Whose set are we recording
const selectedMemberId = ref<number | null>(null)
watch(
  () => data.value?.members,
  (m) => {
    if (m?.length && selectedMemberId.value == null) {
      const mine = session.currentUser?.id
      selectedMemberId.value = mine && m.some(x => x.id === mine) ? mine : m[0].id
    }
  },
  { immediate: true },
)

// Active exercise
const activeExerciseId = ref<number | null>(null)
watch(
  exercises,
  (list) => { if (list.length && activeExerciseId.value == null) activeExerciseId.value = list[0].id },
  { immediate: true },
)
const activeExercise = computed(() => exercises.value.find(e => e.id === activeExerciseId.value) ?? null)

const selectedMemberName = computed(() =>
  data.value?.members.find(m => m.id === selectedMemberId.value)?.name ?? '',
)

// "5 подходов с повторами 5,5,3,3,2" → "5 подх. · 5 · 5 · 3 · 3 · 2"
function targetLabel(ex: DayExercise): string {
  if (!ex.targetReps) return ''
  const reps = ex.targetReps.split(',').map(s => s.trim()).filter(Boolean)
  const setsN = ex.targetSets ?? reps.length
  return `${setsN} подх. · ${reps.join(' · ')}`
}

// Sets of the active exercise for the selected member
const currentSets = computed(() =>
  (data.value?.sets ?? [])
    .filter(s => s.exerciseId === activeExerciseId.value && s.userId === selectedMemberId.value)
    .sort((a, b) => a.setOrder - b.setOrder),
)

// Done-count badge per exercise for the selected member
function doneCount(exId: number): number {
  return (data.value?.sets ?? []).filter(s => s.exerciseId === exId && s.userId === selectedMemberId.value).length
}

// Steppers + last-time prefill
const weight = ref(20)
const reps = ref(10)
const lastHint = ref<{ weight: number; reps: number } | null>(null)

watch(
  [activeExerciseId, selectedMemberId],
  async ([exId, memId]) => {
    if (!exId || !memId) { lastHint.value = null; return }
    try {
      lastHint.value = await api.get<{ weight: number; reps: number } | null>(`/api/exercises/${exId}/last`, { userId: memId })
    } catch {
      lastHint.value = null
    }
    if (lastHint.value) { weight.value = lastHint.value.weight; reps.value = lastHint.value.reps }
  },
  { immediate: true },
)

function stepWeight(delta: number) { weight.value = Math.max(0, Math.round((weight.value + delta) * 4) / 4) }
function stepReps(delta: number) { reps.value = Math.max(0, reps.value + delta) }

const busy = ref(false)

async function record() {
  if (busy.value || !activeExerciseId.value || !selectedMemberId.value) return
  busy.value = true
  try {
    await api.post('/api/sets', {
      workoutId: id, userId: selectedMemberId.value, exerciseId: activeExerciseId.value, weight: weight.value, reps: reps.value,
    })
    await refresh()
  } catch {
    alert('Не удалось записать подход.')
  } finally {
    busy.value = false
  }
}

async function removeSet(setId: number) {
  try {
    await api.del(`/api/sets/${setId}`)
    await refresh()
  } catch {
    alert('Не удалось удалить подход.')
  }
}

// Finish → summary
const finished = ref(false)
const totalSets = computed(() => data.value?.sets.length ?? 0)
const totalTonnage = computed(() => (data.value?.sets ?? []).reduce((acc, s) => acc + s.weight * s.reps, 0))

async function finish() {
  if (busy.value) return
  busy.value = true
  try {
    await api.patch(`/api/workouts/${id}`)
    finished.value = true
  } catch {
    alert('Не удалось завершить тренировку.')
    busy.value = false
  }
}

function chooseAnother() { navigateTo('/select') }

const hasSets = computed(() => totalSets.value > 0)

async function cancel() {
  if (busy.value) return
  if (!confirm('Отменить тренировку? Она будет удалена.')) return
  busy.value = true
  try {
    await api.del(`/api/workouts/${id}`)
    navigateTo('/select')
  } catch (e) {
    alert((e as { statusMessage?: string })?.statusMessage ?? 'Не удалось отменить тренировку.')
    busy.value = false
    refresh()
  }
}
</script>

<template>
  <!-- ── Summary ── -->
  <section v-if="finished" class="page summary">
    <div class="summary-mark"><Icon name="lucide:check" /></div>
    <h1 class="screen-title">Готово</h1>
    <p class="summary-sub">{{ dayTitle }}</p>
    <div class="summary-stats glass">
      <div class="stat">
        <span class="stat-num">{{ totalSets }}</span>
        <span class="stat-label">подходов</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ Math.round(totalTonnage) }}</span>
        <span class="stat-label">кг тоннаж</span>
      </div>
    </div>
    <div class="cta">
      <AppButton icon-end="lucide:move-right" @click="navigateTo('/')">На главную</AppButton>
    </div>
  </section>

  <!-- ── Recording ── -->
  <section v-else class="page">
    <header class="head">
      <h1 class="screen-title">{{ dayTitle }}</h1>
      <div v-if="data && data.members.length > 1" class="members">
        <span class="members-label">Чей подход</span>
        <div class="members-chips">
          <button
            v-for="m in data.members"
            :key="m.id"
            type="button"
            class="member-chip"
            :class="{ active: selectedMemberId === m.id }"
            @click="selectedMemberId = m.id"
          >
            {{ m.name }}
          </button>
        </div>
      </div>
    </header>

    <template v-if="exercises.length">
      <!-- Exercise switcher -->
      <div class="ex-strip">
        <button
          v-for="ex in exercises"
          :key="ex.id"
          type="button"
          class="ex-pill"
          :class="{ active: activeExerciseId === ex.id }"
          @click="activeExerciseId = ex.id"
        >
          {{ ex.name }}
          <span v-if="doneCount(ex.id)" class="ex-badge">{{ doneCount(ex.id) }}</span>
        </button>
      </div>

      <!-- Active exercise panel -->
      <div v-if="activeExercise" class="panel glass">
        <div class="panel-head">
          <h2 class="ex-name">{{ activeExercise.name }}</h2>
          <p v-if="activeExercise.targetReps" class="ex-target">
            Цель: {{ targetLabel(activeExercise) }}
          </p>
        </div>

        <p v-if="data && data.members.length > 1" class="whose">
          Подход за <b>{{ selectedMemberName }}</b>
        </p>

        <p class="last-hint">
          <template v-if="lastHint">Прошлый раз: <b>{{ lastHint.weight }}</b> × <b>{{ lastHint.reps }}</b></template>
          <template v-else>Прошлый раз — нет данных</template>
        </p>

        <div class="steppers">
          <div class="stepper">
            <span class="stepper-label">Вес, кг</span>
            <div class="stepper-row">
              <button type="button" class="step-btn" @click="stepWeight(-2.5)"><Icon name="lucide:minus" /></button>
              <input v-model.number="weight" type="number" inputmode="decimal" step="2.5" min="0" class="step-input" />
              <button type="button" class="step-btn" @click="stepWeight(2.5)"><Icon name="lucide:plus" /></button>
            </div>
          </div>
          <div class="stepper">
            <span class="stepper-label">Повторы</span>
            <div class="stepper-row">
              <button type="button" class="step-btn" @click="stepReps(-1)"><Icon name="lucide:minus" /></button>
              <input v-model.number="reps" type="number" inputmode="numeric" step="1" min="0" class="step-input" />
              <button type="button" class="step-btn" @click="stepReps(1)"><Icon name="lucide:plus" /></button>
            </div>
          </div>
        </div>

        <AppButton icon="lucide:plus" :disabled="busy" @click="record">Записать подход</AppButton>

        <!-- Set list -->
        <ul v-if="currentSets.length" class="set-list">
          <li v-for="(s, i) in currentSets" :key="s.id" class="set-row">
            <span class="set-idx">{{ i + 1 }}</span>
            <span class="set-val">{{ s.weight }} × {{ s.reps }}</span>
            <button type="button" class="set-del" @click="removeSet(s.id)"><Icon name="lucide:x" /></button>
          </li>
        </ul>
      </div>
    </template>

    <div v-else class="empty glass">
      <p class="empty-text">У этой тренировки нет программы дня. Произвольные упражнения появятся позже.</p>
    </div>

    <div class="actions">
      <AppButton icon="lucide:check" variant="accent" :disabled="busy" @click="finish">Завершить</AppButton>
      <AppButton icon="lucide:list" variant="ghost" :disabled="busy" @click="chooseAnother">Выбрать другую</AppButton>
      <button v-if="!hasSets" type="button" class="cancel" :disabled="busy" @click="cancel">Отменить тренировку</button>
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

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 30px);
  line-height: 1.15;
  color: var(--text);
}

.head {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Member chips */
.members {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.members-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.members-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.whose {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  b { color: var(--accent); font-weight: 700; }
}

.member-chip {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-edge-flat);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
}

/* Exercise switcher */
.ex-strip {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.ex-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
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

.ex-badge {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  font-size: 11px;
  font-weight: 700;
}

/* Active exercise panel */
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}

.panel-head { display: flex; flex-direction: column; gap: 2px; }

.ex-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.ex-target {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.last-hint {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  b { color: var(--text); font-weight: 700; }
}

/* Steppers */
.steppers {
  display: flex;
  gap: var(--space-3);
}

.stepper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.stepper-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.stepper-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.step-btn {
  flex-shrink: 0;
  width: 40px;
  height: 44px;
  border: 1px solid var(--glass-edge-flat);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text);
  display: grid;
  place-items: center;
  font-size: 18px;
  cursor: pointer;

  &:active { transform: scale(0.96); }
}

.step-input {
  flex: 1;
  width: 100%;
  min-width: 0;
  height: 44px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text);
  text-align: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 26px;
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  &:focus { outline: none; }
}

/* Recorded sets */
.set-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.set-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.set-idx {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 700;
}

.set-val {
  flex: 1;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
}

.set-del {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  display: grid;
  place-items: center;
  font-size: 16px;
  cursor: pointer;

  &:active { color: var(--text); }
}

.empty {
  padding: var(--space-5) var(--space-4);
  text-align: center;
}

.empty-text { margin: 0; font-size: 14px; color: var(--muted); }

/* Actions */
.actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cancel {
  align-self: center;
  background: none;
  border: 0;
  padding: var(--space-2) var(--space-3);
  font-size: 14px;
  color: var(--muted);
  cursor: pointer;
  &:active:not(:disabled) { color: var(--text); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

/* Summary */
.summary { align-items: center; text-align: center; gap: var(--space-3); }

.summary-mark {
  width: 72px;
  height: 72px;
  margin-top: var(--space-5);
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  display: grid;
  place-items: center;
  font-size: 38px;
}

.summary-sub { margin: 0; font-size: 15px; color: var(--muted); }

.summary-stats {
  display: flex;
  width: 100%;
  margin-top: var(--space-3);
  padding: var(--space-4);
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-num {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 30px;
  color: var(--text);
}

.stat-label { font-size: 12px; color: var(--muted); }

.cta { width: 100%; margin-top: auto; }
</style>
