<script setup lang="ts">
interface PE { peId: number; id: number; name: string; imageUrl: string | null; targetSets: number | null; targetReps: string | null }
interface BankItem { id: number; name: string; nameEn: string | null; muscleGroup: string | null; primaryMuscles: string[] | null; categoryName: string | null; imageUrl: string | null }

const route = useRoute()
const api = useApi()
const { toast, confirm } = useDialog()

const WEEKDAYS: [string, number][] = [['Пн', 1], ['Вт', 2], ['Ср', 3], ['Чт', 4], ['Пт', 5], ['Сб', 6], ['Вс', 7]]

const dayId = ref<number | null>(route.params.id === 'new' ? null : Number(route.params.id))
const code = ref('')
const weekday = ref<number | null>(null)
const items = ref<PE[]>([])
const busy = ref(false)

async function load() {
  if (dayId.value == null) return
  try {
    const res = await api.get<{ day: { code: string; weekday: number | null }; exercises: PE[] }>(`/api/program/days/${dayId.value}`)
    code.value = res.day.code
    weekday.value = res.day.weekday
    items.value = res.exercises
  } catch {
    toast('Не удалось загрузить программу', 'error')
  }
}
onMounted(load)

function goBack() { navigateTo('/select') }

async function ensureDay(): Promise<number | null> {
  if (dayId.value != null) return dayId.value
  const c = code.value.trim()
  if (!c) { toast('Введите название программы', 'error'); return null }
  try {
    const { id } = await api.post<{ id: number }>('/api/program/days', { code: c, weekday: weekday.value })
    dayId.value = id
    window.history.replaceState({}, '', `/program/${id}`)
    return id
  } catch (e) {
    toast((e as { statusMessage?: string })?.statusMessage ?? 'Не удалось создать', 'error')
    return null
  }
}

async function saveDay() {
  if (busy.value) return
  busy.value = true
  try {
    const id = await ensureDay()
    if (id == null) return
    await api.patch(`/api/program/days/${id}`, { code: code.value.trim(), weekday: weekday.value })
    toast('Сохранено', 'success')
  } catch (e) {
    toast((e as { statusMessage?: string })?.statusMessage ?? 'Не удалось сохранить', 'error')
  } finally {
    busy.value = false
  }
}

function setWeekday(d: number) { weekday.value = weekday.value === d ? null : d }

async function saveTarget(it: PE) {
  try {
    await api.patch(`/api/program/exercises/${it.peId}`, {
      targetSets: it.targetSets === null || it.targetSets === undefined ? null : Number(it.targetSets) || null,
      targetReps: it.targetReps?.toString().trim() || null,
    })
  } catch {
    toast('Не удалось сохранить', 'error')
  }
}

async function removeItem(peId: number) {
  try { await api.del(`/api/program/exercises/${peId}`); await load() }
  catch { toast('Не удалось удалить', 'error') }
}

async function move(index: number, dir: -1 | 1) {
  const next = index + dir
  if (next < 0 || next >= items.value.length || dayId.value == null) return
  const arr = items.value.map(i => i.peId)
  ;[arr[index], arr[next]] = [arr[next], arr[index]]
  try {
    await api.patch('/api/program/exercises/reorder', { dayId: dayId.value, ids: arr })
    await load()
  } catch {
    toast('Не удалось переместить', 'error')
  }
}

async function removeDay() {
  if (dayId.value == null) { goBack(); return }
  const ok = await confirm({ title: 'Удалить программу?', message: 'День и его упражнения будут удалены. История тренировок сохранится.', confirmText: 'Удалить', danger: true })
  if (!ok) return
  try { await api.del(`/api/program/days/${dayId.value}`); navigateTo('/select') }
  catch { toast('Не удалось удалить', 'error') }
}

// ── Подбор из банка ──
const picking = ref(false)
const bankSearch = ref('')
const pickMuscle = ref<string | null>(null)
const { data: bank } = await useAsyncData('prog-bank', () => api.get<BankItem[]>('/api/exercises', { full: 1 }), { server: false })
const bankFiltered = computed(() => {
  const q = bankSearch.value.trim().toLowerCase()
  return (bank.value ?? []).filter(e =>
    (pickMuscle.value == null || (e.primaryMuscles ?? []).includes(pickMuscle.value))
    && (!q || e.name.toLowerCase().includes(q) || (e.nameEn ?? '').toLowerCase().includes(q)),
  )
})
const PICK_PAGE = 50
const pickLimit = ref(PICK_PAGE)
watch([bankSearch, pickMuscle, picking], () => { pickLimit.value = PICK_PAGE })
const pickVisible = computed(() => bankFiltered.value.slice(0, pickLimit.value))

async function addExercise(ex: BankItem) {
  const id = await ensureDay()
  if (id == null) return
  try {
    await api.post(`/api/program/days/${id}/exercises`, { exerciseId: ex.id })
    picking.value = false
    bankSearch.value = ''
    await load()
  } catch {
    toast('Не удалось добавить', 'error')
  }
}
</script>

<template>
  <section class="page">
    <header class="head">
      <button type="button" class="icon-btn" aria-label="Назад" @click="goBack"><Icon name="lucide:arrow-left" /></button>
      <h1 class="screen-title">{{ dayId ? 'Программа' : 'Новая программа' }}</h1>
      <button v-if="dayId" type="button" class="icon-btn danger" aria-label="Удалить" @click="removeDay"><Icon name="lucide:trash-2" /></button>
    </header>

    <div class="scroll">
      <label class="field">
        <span class="field-label">Название</span>
        <input v-model="code" type="text" class="field-input" placeholder="Верх A" />
      </label>

      <div class="field">
        <span class="field-label">День недели</span>
        <div class="wd">
          <button
            v-for="[lbl, d] in WEEKDAYS"
            :key="d"
            type="button"
            class="wd-btn"
            :class="{ active: weekday === d }"
            @click="setWeekday(d)"
          >{{ lbl }}</button>
        </div>
        <span class="hint">Можно не привязывать — тогда программа доступна вручную.</span>
      </div>

      <div class="ex-head">
        <span class="field-label">Упражнения ({{ items.length }})</span>
        <button type="button" class="add-link" @click="picking = true"><Icon name="lucide:plus" /> Добавить</button>
      </div>

      <ul v-if="items.length" class="ex-list">
        <li v-for="(it, i) in items" :key="it.peId" class="ex-row glass">
          <div class="ex-move">
            <button type="button" :disabled="i === 0" @click="move(i, -1)"><Icon name="lucide:chevron-up" /></button>
            <button type="button" :disabled="i === items.length - 1" @click="move(i, 1)"><Icon name="lucide:chevron-down" /></button>
          </div>
          <div class="ex-thumb">
            <img v-if="it.imageUrl" :src="it.imageUrl" :alt="it.name" loading="lazy" />
            <Icon v-else name="lucide:dumbbell" />
          </div>
          <div class="ex-main">
            <span class="ex-name">{{ it.name }}</span>
            <div class="ex-target">
              <input v-model="it.targetSets" type="number" inputmode="numeric" min="0" class="t-input t-sets" placeholder="подх." @change="saveTarget(it)" />
              <span class="t-x">×</span>
              <input v-model="it.targetReps" type="text" class="t-input t-reps" placeholder="повт. (8-12)" @change="saveTarget(it)" />
            </div>
          </div>
          <button type="button" class="ex-del" aria-label="Убрать" @click="removeItem(it.peId)"><Icon name="lucide:x" /></button>
        </li>
      </ul>
      <p v-else class="ex-empty">Пока пусто. Добавь упражнения из банка.</p>
    </div>

    <div class="cta">
      <AppButton icon="lucide:check" :disabled="busy" @click="saveDay">Сохранить</AppButton>
    </div>

    <!-- Подбор из банка -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="picking" class="sheet-backdrop" @click.self="picking = false">
          <div class="sheet glass">
            <div class="sheet-head">
              <h2 class="sheet-title">Добавить упражнение</h2>
              <button type="button" class="icon-btn" @click="picking = false"><Icon name="lucide:x" /></button>
            </div>
            <input v-model="bankSearch" type="search" class="field-input pick-search" placeholder="Поиск упражнения" />
            <div class="pick-chips">
              <button type="button" class="pchip" :class="{ active: pickMuscle === null }" @click="pickMuscle = null">Все</button>
              <button
                v-for="m in FILTER_MUSCLES"
                :key="m"
                type="button"
                class="pchip"
                :class="{ active: pickMuscle === m }"
                @click="pickMuscle = pickMuscle === m ? null : m"
              >{{ muscleRu(m) }}</button>
            </div>
            <div class="pick-list">
              <button v-for="e in pickVisible" :key="e.id" type="button" class="pick-row" @click="addExercise(e)">
                <div class="pick-thumb">
                  <img v-if="e.imageUrl" :src="e.imageUrl" :alt="e.name" loading="lazy" />
                  <Icon v-else name="lucide:dumbbell" />
                </div>
                <div class="pick-text">
                  <span class="pick-name">{{ e.name }}</span>
                  <span v-if="e.muscleGroup" class="pick-sub">{{ e.muscleGroup }}</span>
                </div>
                <Icon name="lucide:plus" class="pick-add" />
              </button>
              <button v-if="bankFiltered.length > pickLimit" type="button" class="pick-more" @click="pickLimit += PICK_PAGE">
                Показать ещё ({{ bankFiltered.length - pickLimit }})
              </button>
              <p v-if="!bankFiltered.length" class="pick-empty">Ничего не найдено</p>
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
.icon-btn {
  width: 40px; height: 40px; border: 0; border-radius: 50%;
  background: none; color: var(--muted); display: grid; place-items: center; font-size: 20px; cursor: pointer;
  &:active { color: var(--text); }
  &.danger { margin-left: auto; color: #ff3b30; }
}
.screen-title {
  margin: 0; font-family: var(--font-display); font-weight: 800;
  font-size: clamp(20px, 5.4vw, 26px); color: var(--text);
}

.scroll {
  flex: 1; min-height: 0; overflow-y: auto;
  margin: 0 calc(-1 * var(--space-4));
  padding: 0 var(--space-4) var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-4);
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.field-input {
  width: 100%;
  box-sizing: border-box;
  height: 44px; padding: 0 var(--space-3);
  border: 1px solid var(--glass-edge-flat); border-radius: var(--radius-md);
  background: var(--surface-2); color: var(--text); font-size: 15px;
  &:focus { outline: none; border-color: var(--accent); }
}
.pick-search { flex-shrink: 0; }
.hint { font-size: 12px; color: var(--muted); }

.wd { display: flex; gap: 6px; }
.wd-btn {
  flex: 1; height: 40px; border: 1px solid var(--glass-edge-flat); border-radius: var(--radius-sm);
  background: var(--surface-2); color: var(--muted); font-size: 14px; font-weight: 600; cursor: pointer;
  &.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
}

.ex-head { display: flex; align-items: center; justify-content: space-between; }
.add-link {
  display: inline-flex; align-items: center; gap: 4px; border: 0; background: none;
  color: var(--accent); font-size: 14px; font-weight: 600; cursor: pointer;
}

.ex-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.ex-row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2); }
.ex-move { display: flex; flex-direction: column; }
.ex-move button {
  width: 26px; height: 22px; border: 0; background: none; color: var(--muted); cursor: pointer;
  &:disabled { opacity: 0.3; }
}
.ex-thumb {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden;
  background: var(--surface-2); display: grid; place-items: center; color: var(--muted);
  img { width: 100%; height: 100%; object-fit: cover; }
}
.ex-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ex-name { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.2; }
.ex-target { display: flex; align-items: center; gap: 6px; }
.t-input {
  height: 32px; border: 1px solid var(--glass-edge-flat); border-radius: var(--radius-sm);
  background: var(--surface-2); color: var(--text); font-size: 13px; text-align: center; padding: 0 6px;
  &:focus { outline: none; border-color: var(--accent); }
}
.t-sets { width: 52px; }
.t-reps { flex: 1; min-width: 0; }
.t-x { color: var(--muted); }
.ex-del { width: 30px; height: 30px; border: 0; background: none; color: var(--muted); cursor: pointer; flex-shrink: 0; }

.ex-empty { color: var(--muted); font-size: 14px; text-align: center; padding: var(--space-4) 0; }

.cta { flex-shrink: 0; padding-bottom: var(--space-4); }

/* Bank picker sheet */
.sheet-backdrop {
  position: fixed; inset: 0; z-index: 110;
  display: flex; align-items: flex-end; justify-content: center; background: rgba(0, 0, 0, 0.55);
}
.sheet {
  width: 100%; max-width: 480px;
  padding: var(--space-5) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  display: flex; flex-direction: column; gap: var(--space-3); max-height: 84vh;
}
.sheet-head { display: flex; align-items: center; justify-content: space-between; }
.sheet-title { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 18px; color: var(--text); }
.pick-chips {
  display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; flex-shrink: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
.pchip {
  flex-shrink: 0; min-height: 32px; padding: 0 var(--space-3);
  border: 1px solid var(--glass-edge-flat); border-radius: 999px;
  background: var(--surface); color: var(--muted); font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer;
  &.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
}
.pick-list { overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.pick-row {
  display: flex; align-items: center; gap: var(--space-3); padding: 6px;
  border: 0; border-radius: var(--radius-md); background: var(--surface-2); cursor: pointer; text-align: left;
}
.pick-thumb {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden;
  background: var(--surface); display: grid; place-items: center; color: var(--muted);
  img { width: 100%; height: 100%; object-fit: cover; }
}
.pick-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pick-name { font-size: 14px; font-weight: 600; color: var(--text); }
.pick-sub { font-size: 12px; color: var(--muted); }
.pick-add { color: var(--accent); flex-shrink: 0; }
.pick-more {
  margin-top: 4px;
  padding: var(--space-3);
  border: 1px solid var(--glass-edge-flat); border-radius: var(--radius-md);
  background: var(--surface-2); color: var(--text);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.pick-empty { text-align: center; color: var(--muted); font-size: 14px; padding: var(--space-4) 0; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.22s ease; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
