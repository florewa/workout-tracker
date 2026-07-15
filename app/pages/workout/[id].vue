<script setup lang="ts">
interface MemberLite { id: number; name: string; avatarUrl: string | null }
interface DayExercise {
  id: number
  name: string
  order: number
  targetSets: number | null
  targetReps: string | null
  weightStep: number
}
interface SetRow {
  id: number; userId: number; exerciseId: number; exerciseName: string
  setOrder: number; weight: number; reps: number; skipped: boolean
  variationId: number | null; variationName: string | null; slotExerciseId: number; note: string | null
  createdAt: string
}
interface WorkoutData {
  workout: { id: number; date: string; dayId: number | null; startedAt: string; finishedAt: string | null; recordMode: 'each' | 'single' }
  members: MemberLite[]
  sets: SetRow[]
  exerciseDurations: Array<{
    userId: number; exerciseId: number; durationSeconds: number; startedAt: string; finishedAt: string
  }>
}
interface DayLite { id: number; code: string; title: string }
interface DayDetail { day: { id: number; code: string; title: string }; exercises: DayExercise[] }

const route = useRoute()
const api = useApi()
const session = useSessionStore()
const { toast, confirm } = useDialog()
const id = Number(route.params.id)
const now = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | undefined

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
const activeExercise = computed(() => exercises.value.find(e => e.id === activeExerciseId.value) ?? null)
const activeExerciseStorageKey = `workout:${id}:active-exercise`

// При смене упражнения ставим активную пилюлю левым краём к левому краю ленты —
// справа открывается остаток списка для удобного выбора следующего.
const exStripEl = ref<HTMLElement | null>(null)
watch(activeExerciseId, async () => {
  await nextTick()
  const strip = exStripEl.value
  const active = strip?.querySelector<HTMLElement>('.ex-pill.active')
  if (!strip || !active) return
  const s = strip.getBoundingClientRect()
  const a = active.getBoundingClientRect()
  strip.scrollBy({ left: a.left - s.left, behavior: 'smooth' })
})

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
    .filter(s => s.slotExerciseId === activeExerciseId.value && s.userId === selectedMemberId.value)
    .sort((a, b) => a.setOrder - b.setOrder),
)

const members = computed<MemberLite[]>(() => data.value?.members ?? [])
const recordMode = computed<'each' | 'single'>(() => data.value?.workout.recordMode ?? 'each')

// Живая синхронизация: чужие правки подтягиваем без перезагрузки, держим presence
const { online } = useWorkoutSocket(id, () => { refresh() })
function isOnline(memberId: number): boolean {
  return online.value.some(u => u.userId === memberId)
}
// «Один за всех» с ротацией — только когда участников больше одного
const rotation = computed(() => recordMode.value === 'single' && members.value.length > 1)

function doneCountFor(exId: number, memberId: number | null): number {
  if (memberId == null) return 0
  return (data.value?.sets ?? []).filter(s => s.slotExerciseId === exId && s.userId === memberId).length
}

// Done-count badge per exercise for the selected member
function doneCount(exId: number): number {
  return doneCountFor(exId, selectedMemberId.value)
}

// Целевое число подходов: явное targetSets или длина списка повторов
function targetCount(ex: DayExercise): number | null {
  if (ex.targetSets != null) return ex.targetSets
  if (ex.targetReps) return ex.targetReps.split(',').map(s => s.trim()).filter(Boolean).length
  return null
}

function isMemberComplete(exId: number, memberId: number | null): boolean {
  const ex = exercises.value.find(e => e.id === exId)
  const t = ex ? targetCount(ex) : null
  return t != null && doneCountFor(exId, memberId) >= t
}

// Завершённость упражнения: в ротации — когда у всех участников набрана цель,
// иначе — у выбранного участника.
function isComplete(exId: number): boolean {
  if (rotation.value) return members.value.every(m => isMemberComplete(exId, m.id))
  return isMemberComplete(exId, selectedMemberId.value)
}

// При возврате в незавершённую тренировку сначала восстанавливаем точный выбор
// на этом устройстве. Если локального состояния нет, ориентируемся на последний
// записанный подход и при полностью закрытом упражнении открываем следующее.
const activeExerciseInitialized = ref(false)
watch(
  [exercises, () => data.value?.sets, selectedMemberId, rotation],
  () => {
    const list = exercises.value
    const rows = data.value?.sets
    if (activeExerciseInitialized.value || !list.length || !rows || selectedMemberId.value == null) return

    const storedId = import.meta.client ? Number(localStorage.getItem(activeExerciseStorageKey)) : NaN
    if (Number.isInteger(storedId) && list.some(ex => ex.id === storedId)) {
      activeExerciseId.value = storedId
      activeExerciseInitialized.value = true
      return
    }

    const relevantRows = rotation.value
      ? rows
      : rows.filter(row => row.userId === selectedMemberId.value)
    const latest = [...relevantRows].sort((a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id,
    )[0]

    let restoredId = latest?.slotExerciseId ?? list[0].id
    if (latest && isComplete(restoredId)) {
      const index = list.findIndex(ex => ex.id === restoredId)
      restoredId = list.slice(index + 1).find(ex => !isComplete(ex.id))?.id
        ?? list.find(ex => !isComplete(ex.id))?.id
        ?? restoredId
    }
    activeExerciseId.value = restoredId
    activeExerciseInitialized.value = true
  },
  { immediate: true },
)

const elapsedSeconds = computed(() => {
  const startedAt = data.value?.workout.startedAt
  if (!startedAt) return 0
  const end = data.value?.workout.finishedAt
    ? Date.parse(data.value.workout.finishedAt)
    : now.value
  return Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000))
})

function formatTimer(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const rest = seconds % 60
  return hours > 0
    ? [hours, minutes, rest].map(part => String(part).padStart(2, '0')).join(':')
    : [minutes, rest].map(part => String(part).padStart(2, '0')).join(':')
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} сек`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  return [hours ? `${hours} ч` : '', minutes ? `${minutes} мин` : ''].filter(Boolean).join(' ')
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

watch(activeExerciseId, (exerciseId) => {
  if (import.meta.client && exerciseId != null) {
    localStorage.setItem(activeExerciseStorageKey, String(exerciseId))
  }
})

// Следующий участник по кругу, у которого ещё не набрана цель (или null — все готовы)
function nextIncompleteMember(exId: number, fromId: number | null): number | null {
  const ms = members.value
  if (!ms.length) return null
  const start = ms.findIndex(m => m.id === fromId)
  for (let k = 1; k <= ms.length; k++) {
    const m = ms[(start + k) % ms.length]
    if (!isMemberComplete(exId, m.id)) return m.id
  }
  return null
}

// Куда переходить после записанного/пропущенного подхода
function advance(exId: number) {
  if (rotation.value) {
    const next = nextIncompleteMember(exId, selectedMemberId.value)
    if (next != null) { selectedMemberId.value = next; return }
    // Круг закрыт — следующее незавершённое упражнение, курсор на первого участника
    const idx = exercises.value.findIndex(e => e.id === exId)
    const nextEx = exercises.value.slice(idx + 1).find(e => !isComplete(e.id))
    if (nextEx) { activeExerciseId.value = nextEx.id; selectedMemberId.value = members.value[0]?.id ?? null }
    return
  }
  // Одиночная или «каждый сам»: когда выбранный участник закрыл упражнение,
  // переходим на следующее, где у него ещё не набрана цель.
  if (isMemberComplete(exId, selectedMemberId.value)) {
    const idx = exercises.value.findIndex(e => e.id === exId)
    const nextEx = exercises.value.slice(idx + 1).find(e => !isMemberComplete(e.id, selectedMemberId.value))
    if (nextEx) activeExerciseId.value = nextEx.id
  }
}

// Steppers + last-time prefill
const weight = ref(20)
const reps = ref(10)
const prefill = ref<{ weight: number; reps: number; variationId: number | null; source: 'last' | 'default' } | null>(null)

interface PreviousExerciseWorkout {
  workoutId: number
  date: string
  sets: Array<{
    id: number
    weight: number
    reps: number
    variationId: number | null
    variationName: string | null
  }>
  bestSet: {
    id: number
    weight: number
    reps: number
    variationId: number | null
    variationName: string | null
  }
}

const previousOpen = ref(false)
const previousLoading = ref(false)
const previousWorkout = ref<PreviousExerciseWorkout | null>(null)
const previousTitle = ref('')
const previousMember = ref('')

async function openPreviousWorkout() {
  if (!activeExerciseId.value || !selectedMemberId.value || previousLoading.value) return
  previousTitle.value = activeExercise.value?.name ?? 'Упражнение'
  previousMember.value = selectedMemberName.value
  previousWorkout.value = null
  previousOpen.value = true
  previousLoading.value = true
  try {
    previousWorkout.value = await api.get<PreviousExerciseWorkout | null>(
      `/api/exercises/${activeExerciseId.value}/previous`,
      { userId: selectedMemberId.value, workoutId: id },
    )
  } catch {
    toast('Не удалось загрузить прошлую тренировку', 'error')
    previousOpen.value = false
  } finally {
    previousLoading.value = false
  }
}

function closePreviousWorkout() {
  previousOpen.value = false
}

watch(
  [activeExerciseId, selectedMemberId],
  async ([exId, memId]) => {
    if (!exId || !memId) { prefill.value = null; return }
    try {
      prefill.value = await api.get<{ weight: number; reps: number; variationId: number | null; source: 'last' | 'default' } | null>(`/api/exercises/${exId}/prefill`, { userId: memId, workoutId: id })
    } catch {
      prefill.value = null
    }
    if (prefill.value) { weight.value = prefill.value.weight; reps.value = prefill.value.reps }
  },
  { immediate: true },
)

// ── Вариации упражнения (снаряд) ──
interface Variation { id: number; name: string; altExerciseId: number | null; isDefault: boolean }
const variations = ref<Variation[]>([])
const selectedVariationId = ref<number | null>(null)

watch(activeExerciseId, async (exId) => {
  if (!exId) { variations.value = []; return }
  try { variations.value = await api.get<Variation[]>(`/api/exercises/${exId}/variations`) }
  catch { variations.value = [] }
}, { immediate: true })

// выбор вариации: последняя у участника → дефолтная → первая
watch([variations, prefill], () => {
  if (!variations.value.length) { selectedVariationId.value = null; return }
  const fromPrefill = prefill.value?.variationId
  if (fromPrefill && variations.value.some(v => v.id === fromPrefill)) { selectedVariationId.value = fromPrefill; return }
  selectedVariationId.value = (variations.value.find(v => v.isDefault) ?? variations.value[0]).id
}, { immediate: true })

const activeWeightStep = computed(() => activeExercise.value?.weightStep ?? 2.5)
function stepWeight(direction: -1 | 1) {
  weight.value = Math.max(0, Math.round((weight.value + direction * activeWeightStep.value) * 100) / 100)
}
function stepReps(delta: number) { reps.value = Math.max(0, reps.value + delta) }

// Числовая клавиатура в Telegram не имеет кнопки «Готово» — закрываем её сами:
// явный тап по полю, тап мимо полей или Enter снимают фокус с инпута.
const steppersEl = ref<HTMLElement | null>(null)
function blurActive() {
  const a = document.activeElement
  if (a instanceof HTMLElement) a.blur()
}
function onPointerDown(e: PointerEvent) {
  const a = document.activeElement
  if (a instanceof HTMLInputElement && steppersEl.value && !steppersEl.value.contains(e.target as Node)) {
    a.blur()
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  timerInterval = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  if (timerInterval) clearInterval(timerInterval)
})

const busy = ref(false)

async function record() {
  if (busy.value || !activeExerciseId.value || !selectedMemberId.value) return
  const exId = activeExerciseId.value
  // Переходим дальше только если этот участник ещё не закрыл упражнение —
  // возврат к готовому ради правок обратно не выкинет.
  const wasComplete = isMemberComplete(exId, selectedMemberId.value)
  busy.value = true
  try {
    await api.post('/api/sets', {
      workoutId: id, userId: selectedMemberId.value, exerciseId: exId,
      variationId: variations.value.length ? selectedVariationId.value : null,
      weight: weight.value, reps: reps.value,
    })
    await refresh()
    if (!wasComplete) advance(exId)
  } catch {
    toast('Не удалось записать подход.', 'error')
  } finally {
    busy.value = false
  }
}

async function skip() {
  if (busy.value || !activeExerciseId.value || !selectedMemberId.value) return
  const exId = activeExerciseId.value
  busy.value = true
  try {
    await api.post('/api/sets', {
      workoutId: id, userId: selectedMemberId.value, exerciseId: exId,
      variationId: variations.value.length ? selectedVariationId.value : null,
      skipped: true,
    })
    await refresh()
    advance(exId)
  } catch {
    toast('Не удалось пропустить подход.', 'error')
  } finally {
    busy.value = false
  }
}

async function removeSet(setId: number) {
  try {
    await api.del(`/api/sets/${setId}`)
    await refresh()
  } catch {
    toast('Не удалось удалить подход.', 'error')
  }
}

async function onEditSet({ id: setId, weight: w, reps: r }: { id: number; weight: number; reps: number }) {
  try {
    await api.patch(`/api/sets/${setId}`, { weight: w, reps: r })
    await refresh()
  } catch {
    toast('Не удалось изменить подход.', 'error')
  }
}

async function onReorder(ids: number[]) {
  try {
    await api.patch('/api/sets/reorder', { ids })
    await refresh()
  } catch {
    toast('Не удалось изменить порядок.', 'error')
    await refresh()
  }
}

// Finish → summary (already-finished workouts open straight into the summary)
const finished = ref(Boolean(data.value?.workout.finishedAt))
const justFinished = ref(false)
const realSets = computed(() => (data.value?.sets ?? []).filter(s => !s.skipped))
const totalSets = computed(() => realSets.value.length)
const totalTonnage = computed(() => realSets.value.reduce((acc, s) => acc + s.weight * s.reps, 0))
const multiMember = computed(() => (data.value?.members.length ?? 0) > 1)

function memberName(uid: number): string {
  return data.value?.members.find(m => m.id === uid)?.name ?? ''
}

const summaryDate = computed(() =>
  data.value ? dateWithWeekday(data.value.workout.date, { year: true }) : '',
)

// Подходы, сгруппированные по упражнению (внутри — по участнику и порядку)
const summaryGroups = computed(() => {
  const map = new Map<number, { exerciseId: number; name: string; sets: SetRow[] }>()
  for (const s of data.value?.sets ?? []) {
    let g = map.get(s.slotExerciseId)
    if (!g) {
      g = {
        exerciseId: s.slotExerciseId,
        name: exercises.value.find(exercise => exercise.id === s.slotExerciseId)?.name ?? s.exerciseName,
        sets: [],
      }
      map.set(s.slotExerciseId, g)
    }
    g.sets.push(s)
  }
  return [...map.values()].map(g => ({
    ...g,
    sets: [...g.sets].sort((a, b) => a.userId - b.userId || a.setOrder - b.setOrder),
  }))
})

function exerciseDurations(exerciseId: number) {
  return (data.value?.exerciseDurations ?? []).filter(item => item.exerciseId === exerciseId)
}

async function finish() {
  if (busy.value) return
  busy.value = true
  try {
    await api.patch(`/api/workouts/${id}`)
    await refresh()
    justFinished.value = true
    finished.value = true
  } catch {
    toast('Не удалось завершить тренировку.', 'error')
  } finally {
    busy.value = false
  }
}

function chooseAnother() { navigateTo('/select') }

// Редактирование завершённой тренировки: временно возвращаем её в режим записи
// (эндпоинты подходов проверяют только членство, не статус), правим, возвращаемся.
// finishedAt при этом не трогаем — заново не «завершаем».
const editing = ref(false)
function startEditing() {
  justFinished.value = false
  editing.value = true
  finished.value = false
}
async function doneEditing() {
  if (busy.value) return
  busy.value = true
  try {
    await refresh()
  } finally {
    busy.value = false
  }
  editing.value = false
  finished.value = true
}

// Когда все участники закрыли все упражнения с заданным числом подходов,
// один раз предлагаем закончить тренировку. Отказ сохраняем на этом устройстве,
// чтобы окно не появлялось снова после каждого дополнительного подхода или перезагрузки.
const completionPromptStorageKey = `workout:${id}:completion-prompt-dismissed`
const completionPromptDismissed = ref(
  import.meta.client && localStorage.getItem(completionPromptStorageKey) === '1',
)
const completionPromptOpen = ref(false)
const allPlannedWorkComplete = computed(() => {
  if (!exercises.value.length || !members.value.length) return false
  return exercises.value.every((exercise) => {
    if (targetCount(exercise) == null) return false
    return members.value.every(member => isMemberComplete(exercise.id, member.id))
  })
})

async function offerToFinishCompletedWorkout() {
  if (
    !allPlannedWorkComplete.value
    || completionPromptDismissed.value
    || completionPromptOpen.value
    || finished.value
    || editing.value
    || busy.value
  ) return

  completionPromptOpen.value = true
  const shouldFinish = await confirm({
    title: 'Всё выполнено!',
    message: 'Все участники завершили запланированные подходы и упражнения. Завершить тренировку или продолжить и добавить что-нибудь ещё?',
    confirmText: 'Завершить',
    cancelText: 'Продолжить',
  })
  completionPromptOpen.value = false
  completionPromptDismissed.value = true
  if (import.meta.client) localStorage.setItem(completionPromptStorageKey, '1')
  if (shouldFinish) await finish()
}

watch(
  [allPlannedWorkComplete, busy],
  ([complete, isBusy]) => { if (complete && !isBusy) void offerToFinishCompletedWorkout() },
  { immediate: true, flush: 'post' },
)

const hasSets = computed(() => totalSets.value > 0)

async function cancel() {
  if (busy.value) return
  const ok = await confirm({
    title: 'Отменить тренировку?',
    message: 'Тренировка будет удалена. Это действие нельзя отменить.',
    confirmText: 'Удалить',
    cancelText: 'Назад',
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await api.del(`/api/workouts/${id}`)
    navigateTo('/select')
  } catch (e) {
    toast((e as { statusMessage?: string })?.statusMessage ?? 'Не удалось отменить тренировку.', 'error')
    busy.value = false
    refresh()
  }
}
</script>

<template>
  <!-- ── Summary ── -->
  <section v-if="finished" class="page summary">
    <div v-if="justFinished" class="summary-mark"><Icon name="lucide:check" /></div>
    <h1 class="screen-title">{{ justFinished ? 'Готово' : dayTitle }}</h1>
    <p class="summary-sub">{{ justFinished ? dayTitle : summaryDate }}</p>

    <div class="summary-stats glass">
      <div class="stat">
        <span class="stat-num">{{ totalSets }}</span>
        <span class="stat-label">подходов</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ Math.round(totalTonnage) }}</span>
        <span class="stat-label">кг тоннаж</span>
      </div>
      <div class="stat">
        <span class="stat-num stat-time">{{ formatDuration(elapsedSeconds) }}</span>
        <span class="stat-label">длительность</span>
      </div>
    </div>

    <p v-if="data" class="summary-range">
      <span><Icon name="lucide:play" /> {{ formatClock(data.workout.startedAt) }}</span>
      <span v-if="data.workout.finishedAt"><Icon name="lucide:square" /> {{ formatClock(data.workout.finishedAt) }}</span>
    </p>

    <div v-if="summaryGroups.length" class="detail">
      <div v-for="g in summaryGroups" :key="g.exerciseId" class="detail-ex glass">
        <div class="detail-head">
          <span class="detail-name">{{ g.name }}</span>
          <span class="detail-count">{{ g.sets.filter(s => !s.skipped).length }} подх.</span>
        </div>
        <div v-if="exerciseDurations(g.exerciseId).length" class="detail-times">
          <span v-for="duration in exerciseDurations(g.exerciseId)" :key="duration.userId" class="detail-time">
            <template v-if="multiMember">{{ memberName(duration.userId) }} · </template>{{ formatDuration(duration.durationSeconds) }}
          </span>
        </div>
        <div class="detail-sets">
          <span v-for="s in g.sets" :key="s.id" class="detail-set" :class="{ skipped: s.skipped }">
            <template v-if="s.skipped">пропуск</template>
            <template v-else><b>{{ s.weight }}</b><span class="mul">×</span>{{ s.reps }}</template>
            <em v-if="s.variationName"> · {{ s.variationName }}</em>
            <em v-if="multiMember"> · {{ memberName(s.userId) }}</em>
          </span>
        </div>
      </div>
    </div>

    <div class="cta">
      <AppButton icon-end="lucide:move-right" @click="navigateTo('/')">На главную</AppButton>
      <AppButton icon="lucide:pencil" variant="ghost" @click="startEditing">Редактировать</AppButton>
    </div>
  </section>

  <!-- ── Recording ── -->
  <section v-else class="page">
    <header class="head">
      <div class="head-title-row">
        <h1 class="screen-title">{{ dayTitle }}</h1>
        <span class="workout-timer" aria-label="Время тренировки"><Icon name="lucide:timer" /> {{ formatTimer(elapsedSeconds) }}</span>
      </div>
      <p v-if="editing" class="edit-note"><Icon name="lucide:pencil" /> Редактирование завершённой тренировки</p>
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
            <span v-if="isOnline(m.id)" class="online-dot" :title="'В сети'" aria-hidden="true" />
            <UserAvatar :name="m.name" :src="m.avatarUrl" :size="22" />
            {{ m.name }}
          </button>
        </div>
      </div>
    </header>

    <template v-if="exercises.length">
      <!-- Exercise switcher -->
      <div ref="exStripEl" class="ex-strip">
        <button
          v-for="ex in exercises"
          :key="ex.id"
          type="button"
          class="ex-pill"
          :class="{ active: activeExerciseId === ex.id, complete: isComplete(ex.id) }"
          @click="activeExerciseId = ex.id"
        >
          {{ ex.name }}
          <span v-if="isComplete(ex.id)" class="ex-badge done"><Icon name="lucide:check" /></span>
          <span v-else-if="doneCount(ex.id)" class="ex-badge">{{ doneCount(ex.id) }}</span>
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

        <div v-if="variations.length" class="variations">
          <span class="variations-label">Вариация</span>
          <div class="variations-chips">
            <button
              v-for="v in variations"
              :key="v.id"
              type="button"
              class="member-chip"
              :class="{ active: selectedVariationId === v.id }"
              @click="selectedVariationId = v.id"
            >
              {{ v.name }}
            </button>
          </div>
        </div>

        <div class="last-row">
          <p class="last-hint">
            <template v-if="prefill && prefill.source === 'last'">Прошлый максимум: <b>{{ prefill.weight }}</b> × <b>{{ prefill.reps }}</b></template>
            <template v-else-if="prefill && prefill.source === 'default'">База: <b>{{ prefill.weight }}</b> × <b>{{ prefill.reps }}</b></template>
            <template v-else>Прошлый раз — нет данных</template>
          </p>
          <button
            v-if="prefill?.source === 'last'"
            type="button"
            class="last-info"
            aria-label="Показать подходы прошлой тренировки"
            @click="openPreviousWorkout"
          >
            <Icon name="lucide:info" />
          </button>
        </div>

        <div ref="steppersEl" class="steppers">
          <div class="stepper">
            <span class="stepper-label">Вес, кг</span>
            <div class="stepper-row">
              <button type="button" class="step-btn" @click="stepWeight(-1)"><Icon name="lucide:minus" /></button>
              <input
                v-model.number="weight"
                type="number"
                inputmode="decimal"
                enterkeyhint="done"
                :step="activeWeightStep"
                min="0"
                class="step-input"
                @keydown.enter.prevent="blurActive"
              />
              <button type="button" class="step-btn" @click="stepWeight(1)"><Icon name="lucide:plus" /></button>
            </div>
          </div>
          <div class="stepper">
            <span class="stepper-label">Повторы</span>
            <div class="stepper-row">
              <button type="button" class="step-btn" @click="stepReps(-1)"><Icon name="lucide:minus" /></button>
              <input
                v-model.number="reps"
                type="number"
                inputmode="numeric"
                enterkeyhint="done"
                step="1"
                min="0"
                class="step-input"
                @keydown.enter.prevent="blurActive"
              />
              <button type="button" class="step-btn" @click="stepReps(1)"><Icon name="lucide:plus" /></button>
            </div>
          </div>
        </div>

        <div class="record-row">
          <AppButton icon="lucide:plus" :disabled="busy" @click="record">Записать подход</AppButton>
          <button type="button" class="skip-btn" :disabled="busy" @click="skip">
            <Icon name="lucide:skip-forward" /> Пропустить
          </button>
        </div>

        <!-- Set list -->
        <WorkoutSetList
          v-if="currentSets.length"
          :sets="currentSets"
          @reorder="onReorder"
          @edit="onEditSet"
          @remove="removeSet"
        />
      </div>
    </template>

    <div v-else class="empty glass">
      <p class="empty-text">У этой тренировки нет программы дня. Произвольные упражнения появятся позже.</p>
    </div>

    <div class="actions">
      <template v-if="editing">
        <AppButton icon="lucide:check" variant="accent" :disabled="busy" @click="doneEditing">Готово</AppButton>
      </template>
      <template v-else>
        <AppButton icon="lucide:check" variant="accent" :disabled="busy" @click="finish">Завершить</AppButton>
        <AppButton icon="lucide:list" variant="ghost" :disabled="busy" @click="chooseAnother">Выбрать другую</AppButton>
        <button v-if="!hasSets" type="button" class="cancel" :disabled="busy" @click="cancel">Отменить тренировку</button>
      </template>
    </div>
  </section>

  <Teleport to="body">
    <Transition name="previous-modal">
      <div v-if="previousOpen" class="previous-backdrop" @click.self="closePreviousWorkout">
        <div class="previous-dialog glass" role="dialog" aria-modal="true" aria-labelledby="previous-title">
          <div class="previous-head">
            <div class="previous-heading">
              <span class="previous-kicker">Прошлая тренировка</span>
              <h2 id="previous-title" class="previous-title">{{ previousTitle }}</h2>
              <p v-if="previousWorkout" class="previous-meta">
                {{ dateWithWeekday(previousWorkout.date, { year: true }) }}<template v-if="data && data.members.length > 1"> · {{ previousMember }}</template>
              </p>
            </div>
            <button type="button" class="previous-close" aria-label="Закрыть" @click="closePreviousWorkout">
              <Icon name="lucide:x" />
            </button>
          </div>

          <div v-if="previousLoading" class="previous-loading">
            <Icon name="lucide:loader-circle" />
            Загружаю подходы
          </div>
          <div v-else-if="previousWorkout?.sets.length" class="previous-sets">
            <div
              v-for="(set, index) in previousWorkout.sets"
              :key="set.id"
              class="previous-set"
              :class="{ best: set.id === previousWorkout.bestSet.id }"
            >
              <span class="previous-number">{{ index + 1 }}</span>
              <div class="previous-value">
                <span><b>{{ set.weight }}</b> кг</span>
                <span class="previous-mul">×</span>
                <span><b>{{ set.reps }}</b> повт.</span>
                <span v-if="set.id === previousWorkout.bestSet.id" class="previous-best">Максимум</span>
              </div>
              <span v-if="set.variationName" class="previous-variation">{{ set.variationName }}</span>
            </div>
          </div>
          <p v-else class="previous-empty">Подходы прошлой тренировки не найдены.</p>

          <p v-if="previousWorkout?.sets.length" class="previous-note">
            В строке «Прошлый максимум» показан подход с максимальным весом. При равном весе — с большим числом повторений.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
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

.head-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.workout-timer {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.edit-note {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
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

.variations { display: flex; flex-direction: column; gap: var(--space-2); }
.variations-label {
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted);
}
.variations-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }

.member-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 36px;
  padding: 0 var(--space-3) 0 7px;
  border: 1px solid var(--glass-edge-flat);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
}

.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34c759;
  flex-shrink: 0;
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

  &.complete:not(.active) {
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    color: var(--text);
  }
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

  &.done {
    padding: 0;
    width: 18px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 12px;
  }
}

/* На активной (оранжевой) пилюле галочка читается инверсно */
.ex-pill.active .ex-badge.done {
  background: var(--accent-text);
  color: var(--accent);
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

.last-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.last-hint {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  b { color: var(--text); font-weight: 700; }
}

.last-info {
  padding: 0;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-edge-flat);
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--accent);
  display: grid;
  place-items: center;
  font-size: 16px;
  cursor: pointer;

  &:active { transform: scale(0.92); }
}

.record-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skip-btn {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 0;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;

  &:active:not(:disabled) { color: var(--text); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
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
  width: 38px;
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
  padding: 0 2px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text);
  text-align: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(18px, 5vw, 24px);
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  &:focus { outline: none; }
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

.stat-time { font-size: 20px; line-height: 36px; }

.stat-label { font-size: 12px; color: var(--muted); }

.summary-range {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--muted);
  font-size: 13px;

  span { display: inline-flex; align-items: center; gap: 5px; }
}

/* Per-exercise breakdown */
.detail {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  text-align: left;
  margin-top: var(--space-2);
}

.detail-ex {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}

.detail-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.detail-name { font-size: 15px; font-weight: 700; color: var(--text); }
.detail-count { font-size: 12px; color: var(--muted); flex-shrink: 0; }

.detail-times {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-time {
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

.detail-sets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.detail-set {
  display: inline-flex;
  align-items: baseline;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 14px;
  color: var(--text);

  b { font-family: var(--font-display); font-weight: 800; }
  .mul { color: var(--muted); margin: 0 2px; }
  em { color: var(--muted); font-style: normal; font-size: 12px; }

  &.skipped { color: var(--muted); font-style: italic; }
}

.cta { width: 100%; margin-top: auto; display: flex; flex-direction: column; gap: var(--space-2); }

.previous-backdrop {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: grid;
  align-items: end;
  padding: var(--space-4);
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  background: rgba(0, 0, 0, 0.62);
}

.previous-dialog {
  width: 100%;
  max-width: 420px;
  max-height: min(76vh, 620px);
  margin: 0 auto;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-y: auto;
}

.previous-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.previous-heading { min-width: 0; }

.previous-kicker {
  display: block;
  margin-bottom: 4px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.previous-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  line-height: 1.25;
  color: var(--text);
}

.previous-meta {
  margin: var(--space-1) 0 0;
  font-size: 13px;
  color: var(--muted);
}

.previous-close {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--muted);
  display: grid;
  place-items: center;
  font-size: 20px;
  cursor: pointer;
}

.previous-loading,
.previous-empty {
  margin: 0;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--muted);
  font-size: 14px;
}

.previous-loading :deep(svg) { animation: previous-spin 0.8s linear infinite; }

.previous-sets {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.previous-set {
  min-height: 54px;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  display: grid;
  grid-template-columns: 28px 1fr;
  align-items: center;
  column-gap: var(--space-3);

  &.best { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 58%, transparent); }
}

.previous-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
}

.previous-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: var(--muted);
  font-size: 14px;

  b {
    font-family: var(--font-display);
    color: var(--text);
    font-size: 17px;
  }
}

.previous-mul { color: var(--accent); font-weight: 800; }

.previous-best {
  margin-left: auto;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.previous-variation {
  grid-column: 2;
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
}

.previous-note {
  margin: 0;
  padding-top: var(--space-3);
  border-top: 1px solid var(--glass-edge-flat);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.previous-modal-enter-active,
.previous-modal-leave-active { transition: opacity 0.18s ease; }
.previous-modal-enter-from,
.previous-modal-leave-to { opacity: 0; }
.previous-modal-enter-active .previous-dialog,
.previous-modal-leave-active .previous-dialog { transition: transform 0.18s ease; }
.previous-modal-enter-from .previous-dialog,
.previous-modal-leave-to .previous-dialog { transform: translateY(18px); }

@keyframes previous-spin { to { transform: rotate(360deg); } }
</style>
