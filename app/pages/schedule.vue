<script setup lang="ts">
interface ProgramDay {
  id: number
  code: string
  title: string
  order: number
}

interface WeeklySlot {
  weekday: number
  day: ProgramDay
}

interface DateSlot {
  date: string
  day: ProgramDay | null
  source: 'weekly' | 'override' | null
}

type PickerTarget =
  | { kind: 'weekly'; weekday: number }
  | { kind: 'date'; date: string }

const api = useApi()
const { toast } = useDialog()
const WEEKDAYS = [
  { short: 'ПН', full: 'Понедельник', value: 1 },
  { short: 'ВТ', full: 'Вторник', value: 2 },
  { short: 'СР', full: 'Среда', value: 3 },
  { short: 'ЧТ', full: 'Четверг', value: 4 },
  { short: 'ПТ', full: 'Пятница', value: 5 },
  { short: 'СБ', full: 'Суббота', value: 6 },
  { short: 'ВС', full: 'Воскресенье', value: 7 },
]

const todayIso = localIso(new Date())
const currentView = ref<'week' | 'month'>('week')
const anchorMonth = ref(todayIso.slice(0, 7) + '-01')
const days = ref<ProgramDay[]>([])
const weekly = ref<WeeklySlot[]>([])
const monthSlots = ref<DateSlot[]>([])
const loading = ref(true)
const saving = ref(false)
const picker = ref<PickerTarget | null>(null)

const monthCells = computed(() => {
  const first = new Date(anchorMonth.value + 'T12:00:00')
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12)
  const end = new Date(last)
  end.setDate(last.getDate() + (7 - (((last.getDay() + 6) % 7) + 1)) % 7)

  const result: { date: string; dayNumber: number; inMonth: boolean }[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    result.push({
      date: localIso(cursor),
      dayNumber: cursor.getDate(),
      inMonth: cursor.getMonth() === first.getMonth(),
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
})

const rangeStart = computed(() => monthCells.value[0]?.date ?? anchorMonth.value)
const rangeEnd = computed(() => monthCells.value.at(-1)?.date ?? anchorMonth.value)
const monthTitle = computed(() => {
  const value = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
    .format(new Date(anchorMonth.value + 'T12:00:00'))
  return value.charAt(0).toUpperCase() + value.slice(1)
})
const weeklyMap = computed(() => new Map(weekly.value.map(slot => [slot.weekday, slot.day])))
const monthMap = computed(() => new Map(monthSlots.value.map(slot => [slot.date, slot])))
const pickerDayId = computed(() => {
  const target = picker.value
  if (!target) return null
  return target.kind === 'weekly'
    ? weeklyMap.value.get(target.weekday)?.id ?? null
    : monthMap.value.get(target.date)?.day?.id ?? null
})

const pickerTitle = computed(() => {
  const target = picker.value
  if (!target) return ''
  if (target.kind === 'weekly') {
    return WEEKDAYS.find(day => day.value === target.weekday)?.full ?? 'День недели'
  }
  return dateWithWeekday(new Date(target.date + 'T12:00:00'), { year: true })
})

async function loadBase() {
  const [programDays, week] = await Promise.all([
    api.get<ProgramDay[]>('/api/program/days'),
    api.get<WeeklySlot[]>('/api/program/schedule/weekly'),
  ])
  days.value = programDays
  weekly.value = week
}

async function loadMonth() {
  monthSlots.value = await api.get<DateSlot[]>('/api/program/schedule', {
    from: rangeStart.value,
    to: rangeEnd.value,
  })
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadBase(), loadMonth()])
  } catch {
    toast('Не удалось загрузить расписание', 'error')
  } finally {
    loading.value = false
  }
}

await loadAll()

watch(anchorMonth, async () => {
  loading.value = true
  try { await loadMonth() }
  catch { toast('Не удалось загрузить месяц', 'error') }
  finally { loading.value = false }
})

function goBack() { navigateTo('/select') }
function openWeek(weekday: number) { picker.value = { kind: 'weekly', weekday } }
function openDate(date: string) { picker.value = { kind: 'date', date } }
function closePicker() { if (!saving.value) picker.value = null }

function shiftMonth(delta: number) {
  const date = new Date(anchorMonth.value + 'T12:00:00')
  date.setMonth(date.getMonth() + delta, 1)
  anchorMonth.value = localIso(date).slice(0, 7) + '-01'
}

async function refreshAfterSave(kind: PickerTarget['kind']) {
  if (kind === 'weekly') await Promise.all([loadBase(), loadMonth()])
  else await loadMonth()
}

async function assignProgram(dayId: number) {
  const target = picker.value
  if (!target || saving.value) return
  saving.value = true
  try {
    if (target.kind === 'weekly') await api.put(`/api/program/schedule/weekly/${target.weekday}`, { dayId })
    else await api.put(`/api/program/schedule/dates/${target.date}`, { dayId })
    await refreshAfterSave(target.kind)
    picker.value = null
    toast('Расписание обновлено', 'success')
  } catch (error) {
    toast((error as { statusMessage?: string }).statusMessage ?? 'Не удалось сохранить', 'error')
  } finally {
    saving.value = false
  }
}

async function clearAssignment() {
  const target = picker.value
  if (!target || saving.value) return
  saving.value = true
  try {
    if (target.kind === 'weekly') await api.del(`/api/program/schedule/weekly/${target.weekday}`)
    else await api.del(`/api/program/schedule/dates/${target.date}`)
    await refreshAfterSave(target.kind)
    picker.value = null
    toast(target.kind === 'weekly' ? 'День освобождён' : 'Возвращён недельный план', 'success')
  } catch {
    toast('Не удалось изменить расписание', 'error')
  } finally {
    saving.value = false
  }
}

async function setRestDay() {
  const target = picker.value
  if (!target || target.kind !== 'date' || saving.value) return
  saving.value = true
  try {
    await api.put(`/api/program/schedule/dates/${target.date}`, { dayId: null })
    await loadMonth()
    picker.value = null
    toast('Назначен день отдыха', 'success')
  } catch {
    toast('Не удалось изменить расписание', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="page">
    <header class="head">
      <button type="button" class="icon-btn" aria-label="Назад" @click="goBack">
        <Icon name="lucide:arrow-left" />
      </button>
      <div class="head-text">
        <h1 class="screen-title">Расписание</h1>
        <span class="head-sub">Недельный ритм и точные даты</span>
      </div>
    </header>

    <div class="view-switch" role="tablist" aria-label="Вид расписания">
      <button type="button" role="tab" :aria-selected="currentView === 'week'" :class="{ active: currentView === 'week' }" @click="currentView = 'week'">
        Неделя
      </button>
      <button type="button" role="tab" :aria-selected="currentView === 'month'" :class="{ active: currentView === 'month' }" @click="currentView = 'month'">
        Месяц
      </button>
    </div>

    <div class="scroll">
      <template v-if="currentView === 'week'">
        <div class="intro glass">
          <Icon name="lucide:repeat-2" class="intro-icon" aria-hidden="true" />
          <p><strong>Базовая неделя</strong><span>Повторяется автоматически. Одну программу можно поставить на несколько дней.</span></p>
        </div>

        <div class="week-list" :aria-busy="loading">
          <button v-for="day in WEEKDAYS" :key="day.value" type="button" class="week-row glass" @click="openWeek(day.value)">
            <span class="week-badge">{{ day.short }}</span>
            <span class="week-info">
              <span class="week-name">{{ day.full }}</span>
              <span v-if="weeklyMap.get(day.value)" class="week-program">{{ weeklyMap.get(day.value)?.code }}</span>
              <span v-else class="week-rest">Отдых</span>
            </span>
            <Icon name="lucide:chevron-right" class="row-chevron" aria-hidden="true" />
          </button>
        </div>
      </template>

      <template v-else>
        <div class="month-head">
          <button type="button" class="month-arrow" aria-label="Предыдущий месяц" @click="shiftMonth(-1)"><Icon name="lucide:chevron-left" /></button>
          <h2 class="month-title">{{ monthTitle }}</h2>
          <button type="button" class="month-arrow" aria-label="Следующий месяц" @click="shiftMonth(1)"><Icon name="lucide:chevron-right" /></button>
        </div>

        <div class="calendar glass" :class="{ loading }">
          <span v-for="day in WEEKDAYS" :key="day.value" class="cal-weekday">{{ day.short }}</span>
          <button
            v-for="cell in monthCells"
            :key="cell.date"
            type="button"
            class="cal-cell"
            :class="{
              muted: !cell.inMonth,
              today: cell.date === todayIso,
              override: monthMap.get(cell.date)?.source === 'override',
            }"
            :aria-label="dateWithWeekday(new Date(cell.date + 'T12:00:00'))"
            @click="openDate(cell.date)"
          >
            <span class="cal-num">{{ cell.dayNumber }}</span>
            <span v-if="monthMap.get(cell.date)?.day" class="cal-program">{{ monthMap.get(cell.date)?.day?.code }}</span>
            <Icon v-else-if="monthMap.get(cell.date)?.source === 'override'" name="lucide:moon" class="cal-rest" aria-hidden="true" />
          </button>
        </div>

        <div class="legend">
          <span><i class="legend-dot" /> Недельный план</span>
          <span><i class="legend-dot override" /> Изменено на дату</span>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="picker" class="sheet-backdrop" @click.self="closePicker">
          <div class="sheet glass">
            <div class="sheet-head">
              <div>
                <span class="sheet-kicker">Назначить программу</span>
                <h2 class="sheet-title">{{ pickerTitle }}</h2>
              </div>
              <button type="button" class="icon-btn" aria-label="Закрыть" @click="closePicker"><Icon name="lucide:x" /></button>
            </div>

            <div class="sheet-actions">
              <button v-if="picker.kind === 'date'" type="button" class="special-row" :disabled="saving" @click="clearAssignment">
                <span class="special-icon"><Icon name="lucide:repeat-2" /></span>
                <span><strong>По недельному плану</strong><small>Убрать изменение для этой даты</small></span>
              </button>
              <button v-if="picker.kind === 'date'" type="button" class="special-row" :disabled="saving" @click="setRestDay">
                <span class="special-icon"><Icon name="lucide:moon" /></span>
                <span><strong>День отдыха</strong><small>Не ставить тренировку в эту дату</small></span>
              </button>
              <button v-else type="button" class="special-row" :disabled="saving" @click="clearAssignment">
                <span class="special-icon"><Icon name="lucide:moon" /></span>
                <span><strong>Без тренировки</strong><small>Оставить этот день свободным</small></span>
              </button>
            </div>

            <div class="program-list">
              <button v-for="day in days" :key="day.id" type="button" class="program-row" :class="{ current: pickerDayId === day.id }" :disabled="saving" @click="assignProgram(day.id)">
                <span class="program-thumb">
                  <img v-if="programPhoto(day.code)" :src="programPhoto(day.code) || ''" :alt="day.code" />
                  <Icon v-else name="lucide:dumbbell" />
                </span>
                <span class="program-info">
                  <strong>{{ day.code }}</strong>
                  <small v-if="dayFocus(day.title)">{{ dayFocus(day.title) }}</small>
                </span>
                <Icon :name="pickerDayId === day.id ? 'lucide:check' : 'lucide:plus'" class="program-add" aria-hidden="true" />
              </button>
              <p v-if="!days.length" class="empty">Сначала создай хотя бы одну программу.</p>
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
  padding: var(--space-4) var(--space-4) 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow: hidden;
}
.head { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
.head-text { display: flex; flex-direction: column; gap: 1px; }
.screen-title { margin: 0; font-family: var(--font-display); font-size: clamp(20px, 5.4vw, 26px); font-weight: 800; color: var(--text); }
.head-sub { font-size: 12px; color: var(--muted); }
.icon-btn {
  width: 40px; height: 40px; flex-shrink: 0; border: 0; border-radius: 50%;
  background: none; color: var(--muted); display: grid; place-items: center; font-size: 20px; cursor: pointer;
  &:active { color: var(--text); }
}
.view-switch {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--surface-2);

  button {
    height: 38px; border: 0; border-radius: var(--radius-sm); background: transparent;
    color: var(--muted); font-size: 14px; font-weight: 700; cursor: pointer;
    &.active { background: var(--surface); color: var(--text); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14); }
  }
}
.scroll {
  flex: 1; min-height: 0; overflow-y: auto;
  margin: 0 calc(-1 * var(--space-4));
  padding: var(--space-1) var(--space-4) var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
}
.intro { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); }
.intro-icon { flex-shrink: 0; font-size: 24px; color: var(--accent); }
.intro p { margin: 0; display: flex; flex-direction: column; gap: 2px; color: var(--text); font-size: 14px; }
.intro p span { color: var(--muted); font-size: 12px; line-height: 1.35; }
.week-list { display: flex; flex-direction: column; gap: var(--space-2); }
.week-row {
  width: 100%; min-height: 68px; padding: var(--space-2) var(--space-3); border: 0;
  display: flex; align-items: center; gap: var(--space-3); color: var(--text); text-align: left; cursor: pointer;
  &:active { transform: scale(0.99); }
}
.week-badge {
  width: 44px; height: 44px; flex-shrink: 0; display: grid; place-items: center;
  border-radius: var(--radius-md); background: var(--surface-2); color: var(--accent);
  font-family: var(--font-display); font-size: 12px; font-weight: 800;
}
.week-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.week-name { font-size: 12px; color: var(--muted); }
.week-program { font-size: 15px; font-weight: 700; color: var(--text); }
.week-rest { font-size: 14px; color: var(--muted); }
.row-chevron { flex-shrink: 0; color: var(--muted); }
.month-head { display: flex; align-items: center; justify-content: space-between; min-height: 44px; }
.month-title { margin: 0; font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--text); }
.month-arrow { width: 40px; height: 40px; border: 0; border-radius: 50%; background: var(--surface-2); color: var(--text); display: grid; place-items: center; cursor: pointer; }
.calendar {
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px; padding: var(--space-2); overflow: hidden;
  &.loading { opacity: 0.55; pointer-events: none; }
}
.cal-weekday { padding: 7px 0 9px; text-align: center; font-size: 9px; font-weight: 800; color: var(--muted); }
.cal-cell {
  position: relative; min-width: 0; height: 66px; padding: 7px 3px 4px;
  border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent;
  color: var(--text); display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer;
  &.muted { opacity: 0.35; }
  &.today { border-color: var(--accent); }
  &.override::after { content: ''; position: absolute; top: 5px; right: 5px; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
  &:active { background: var(--surface-2); }
}
.cal-num { font-family: var(--font-display); font-size: 12px; font-weight: 700; }
.cal-program {
  width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 3px 2px; border-radius: 5px; background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent); font-size: 8px; font-weight: 800; text-align: center;
}
.cal-rest { color: var(--muted); font-size: 13px; }
.legend { display: flex; flex-wrap: wrap; gap: var(--space-3); color: var(--muted); font-size: 11px; }
.legend span { display: flex; align-items: center; gap: 5px; }
.legend-dot { width: 7px; height: 7px; border-radius: 50%; background: color-mix(in srgb, var(--accent) 35%, transparent); }
.legend-dot.override { background: var(--accent); }
.sheet-backdrop { position: fixed; inset: 0; z-index: 110; display: flex; align-items: flex-end; justify-content: center; background: rgba(0, 0, 0, 0.58); }
.sheet {
  width: 100%; max-width: 480px; max-height: 84vh;
  padding: var(--space-5) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  display: flex; flex-direction: column; gap: var(--space-3);
}
.sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.sheet-kicker { display: block; margin-bottom: 3px; color: var(--accent); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.sheet-title { margin: 0; color: var(--text); font-family: var(--font-display); font-size: 18px; font-weight: 800; }
.sheet-actions { display: flex; flex-direction: column; gap: 6px; }
.special-row, .program-row {
  width: 100%; border: 0; background: transparent; color: var(--text); text-align: left;
  display: flex; align-items: center; gap: var(--space-3); cursor: pointer;
  &:disabled { opacity: .55; }
}
.special-row { min-height: 54px; padding: var(--space-2); border-radius: var(--radius-md); background: var(--surface-2); }
.special-icon { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.special-row > span:last-child, .program-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.special-row strong, .program-info strong { font-size: 14px; }
.special-row small, .program-info small { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.program-list { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.program-row { min-height: 60px; padding: 6px 2px; border-bottom: 1px solid var(--glass-edge-flat); }
.program-row.current { color: var(--accent); }
.program-thumb { width: 46px; height: 46px; flex-shrink: 0; overflow: hidden; border-radius: var(--radius-sm); background: var(--surface-2); color: var(--muted); display: grid; place-items: center; }
.program-thumb img { width: 100%; height: 100%; object-fit: cover; }
.program-add { flex-shrink: 0; color: var(--accent); font-size: 18px; }
.empty { margin: var(--space-4) 0; text-align: center; color: var(--muted); font-size: 13px; }
</style>
