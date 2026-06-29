<script setup lang="ts">
interface Category { id: number; name: string; order: number }
interface ExerciseRow {
  id: number; name: string; nameEn: string | null; muscleGroup: string | null
  categoryId: number | null; categoryName: string | null; imageUrl: string | null
}

const api = useApi()
const initData = useState<string>('tgInitData', () => '')
const { toast, confirm } = useDialog()

const search = ref('')
const activeCategory = ref<number | null>(null)
const activeMuscle = ref<string | null>(null)

const { data: categories, refresh: refreshCategories } = await useAsyncData(
  'bank-categories', () => api.get<Category[]>('/api/categories'), { server: false },
)
const { data: exercises, refresh: refreshExercises } = await useAsyncData(
  'bank-exercises',
  () => api.get<ExerciseRow[]>('/api/exercises', { full: 1 }),
  { server: false },
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (exercises.value ?? []).filter(e =>
    (activeCategory.value == null || e.categoryId === activeCategory.value)
    && (activeMuscle.value == null || (e.primaryMuscles ?? []).includes(activeMuscle.value))
    && (!q || e.name.toLowerCase().includes(q) || (e.nameEn ?? '').toLowerCase().includes(q)),
  )
})

// порционный показ — в банке сотни упражнений
const PAGE = 60
const limit = ref(PAGE)
watch([search, activeCategory, activeMuscle], () => { limit.value = PAGE })
const visible = computed(() => filtered.value.slice(0, limit.value))

// ── Детальная карточка ──
interface ExerciseDetail {
  id: number; name: string; nameEn: string | null; muscleGroup: string | null
  primaryMuscles: string[] | null; secondaryMuscles: string[] | null
  equipment: string | null; instructions: string | null; source: string | null
  categoryId: number | null; categoryName: string | null; imageUrl: string | null
}
const detail = ref<ExerciseDetail | null>(null)
async function openDetail(id: number) {
  try { detail.value = await api.get<ExerciseDetail>(`/api/exercises/${id}`) }
  catch { toast('Не удалось открыть упражнение', 'error') }
}
function closeDetail() { detail.value = null }
const detailSteps = computed(() => (detail.value?.instructions ?? '').split('\n').map(s => s.trim()).filter(Boolean))
const similar = computed(() => {
  const d = detail.value
  const key = d?.primaryMuscles?.[0]
  if (!key) return []
  return (exercises.value ?? []).filter(e => e.id !== d!.id && (e.primaryMuscles ?? []).includes(key)).slice(0, 8)
})
function editFromDetail() {
  const d = detail.value
  if (!d) return
  detail.value = null
  openEdit({ id: d.id, name: d.name, nameEn: d.nameEn, muscleGroup: d.muscleGroup, primaryMuscles: d.primaryMuscles, categoryId: d.categoryId, categoryName: d.categoryName, imageUrl: d.imageUrl })
}

function goBack() { navigateTo('/select') }

// ── Создание/правка ──
const editing = ref<null | { id: number | null; name: string; categoryId: number | null; muscleGroup: string }>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pickedFile = ref<File | null>(null)
const pickedPreview = ref<string | null>(null)
const saving = ref(false)

function openCreate() {
  editing.value = { id: null, name: '', categoryId: activeCategory.value, muscleGroup: '' }
  pickedFile.value = null
  pickedPreview.value = null
}
function openEdit(e: ExerciseRow) {
  editing.value = { id: e.id, name: e.name, categoryId: e.categoryId, muscleGroup: e.muscleGroup ?? '' }
  pickedFile.value = null
  pickedPreview.value = e.imageUrl
}
function closeEdit() { editing.value = null }

function onPickFile(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  pickedFile.value = file
  pickedPreview.value = URL.createObjectURL(file)
}

async function uploadImage(id: number, file: File) {
  const fd = new FormData()
  fd.append('image', file)
  await $fetch(`/api/exercises/${id}/image`, {
    method: 'POST',
    headers: initData.value ? { Authorization: `tma ${initData.value}` } : {},
    body: fd,
  })
}

async function save() {
  const e = editing.value
  if (!e || saving.value) return
  const name = e.name.trim()
  if (!name) { toast('Введите название', 'error'); return }
  saving.value = true
  try {
    let id = e.id
    if (id == null) {
      const res = await api.post<{ id: number }>('/api/exercises', { name, categoryId: e.categoryId, muscleGroup: e.muscleGroup })
      id = res.id
    } else {
      await api.patch(`/api/exercises/${id}`, { name, categoryId: e.categoryId, muscleGroup: e.muscleGroup })
    }
    if (pickedFile.value && id != null) await uploadImage(id, pickedFile.value)
    editing.value = null
    await refreshExercises()
  } catch (err) {
    toast((err as { statusMessage?: string })?.statusMessage ?? 'Не удалось сохранить', 'error')
  } finally {
    saving.value = false
  }
}

async function removeExercise() {
  const e = editing.value
  if (!e?.id) return
  const ok = await confirm({ title: 'Удалить упражнение?', message: 'Оно скроется из банка. История подходов сохранится.', confirmText: 'Удалить', danger: true })
  if (!ok) return
  try {
    await api.del(`/api/exercises/${e.id}`)
    editing.value = null
    await refreshExercises()
  } catch {
    toast('Не удалось удалить', 'error')
  }
}

// ── Категории ──
const managingCategories = ref(false)
const newCategory = ref('')
async function addCategory() {
  const name = newCategory.value.trim()
  if (!name) return
  try {
    await api.post('/api/categories', { name })
    newCategory.value = ''
    await refreshCategories()
  } catch {
    toast('Не удалось добавить категорию', 'error')
  }
}
</script>

<template>
  <section class="page">
    <header class="head">
      <button type="button" class="back" aria-label="Назад" @click="goBack">
        <Icon name="lucide:arrow-left" />
      </button>
      <h1 class="screen-title">Упражнения</h1>
      <button type="button" class="head-action" @click="managingCategories = !managingCategories">
        <Icon name="lucide:settings-2" />
      </button>
    </header>

    <div class="search">
      <Icon name="lucide:search" class="search-icon" />
      <input v-model="search" type="search" placeholder="Поиск упражнения" class="search-input" />
    </div>

    <!-- Управление категориями -->
    <div v-if="managingCategories" class="cat-manage glass">
      <div class="cat-add">
        <input v-model="newCategory" type="text" placeholder="Новая категория" class="cat-input" @keydown.enter="addCategory" />
        <button type="button" class="cat-add-btn" @click="addCategory"><Icon name="lucide:plus" /></button>
      </div>
      <div v-for="c in categories" :key="c.id" class="cat-row">
        <span>{{ c.name }}</span>
      </div>
    </div>

    <!-- Фильтр по категориям -->
    <div class="chips">
      <button type="button" class="chip" :class="{ active: activeCategory === null }" @click="activeCategory = null">Все</button>
      <button
        v-for="c in categories"
        :key="c.id"
        type="button"
        class="chip"
        :class="{ active: activeCategory === c.id }"
        @click="activeCategory = c.id"
      >
        {{ c.name }}
      </button>
    </div>

    <div class="chips muscles">
      <button type="button" class="chip" :class="{ active: activeMuscle === null }" @click="activeMuscle = null">Все мышцы</button>
      <button
        v-for="m in FILTER_MUSCLES"
        :key="m"
        type="button"
        class="chip"
        :class="{ active: activeMuscle === m }"
        @click="activeMuscle = activeMuscle === m ? null : m"
      >
        {{ muscleRu(m) }}
      </button>
    </div>

    <div class="scroll">
      <template v-if="filtered.length">
        <div class="grid">
          <button v-for="e in visible" :key="e.id" type="button" class="card glass" @click="openDetail(e.id)">
            <div class="thumb">
              <img v-if="e.imageUrl" :src="e.imageUrl" :alt="e.name" loading="lazy" />
              <Icon v-else name="lucide:dumbbell" class="thumb-fallback" />
            </div>
            <div class="card-body">
              <span class="card-name">{{ e.name }}</span>
              <span v-if="e.muscleGroup || e.categoryName" class="card-sub">{{ e.muscleGroup || e.categoryName }}</span>
            </div>
          </button>
        </div>
        <button v-if="filtered.length > limit" type="button" class="more" @click="limit += PAGE">
          Показать ещё ({{ filtered.length - limit }})
        </button>
      </template>
      <p v-else class="empty">Ничего не найдено</p>
    </div>

    <button type="button" class="fab" aria-label="Создать упражнение" @click="openCreate">
      <Icon name="lucide:plus" />
    </button>

    <!-- Деталь упражнения -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="detail" class="sheet-backdrop" @click.self="closeDetail">
          <div class="sheet glass">
            <div class="sheet-head">
              <h2 class="sheet-title">{{ detail.name }}</h2>
              <button type="button" class="sheet-close" @click="closeDetail"><Icon name="lucide:x" /></button>
            </div>

            <img v-if="detail.imageUrl" :src="detail.imageUrl" :alt="detail.name" class="detail-image" />

            <MuscleMap
              v-if="detail.primaryMuscles?.length"
              :primary="detail.primaryMuscles ?? []"
              :secondary="detail.secondaryMuscles ?? []"
            />

            <div v-if="detail.muscleGroup || detail.equipment" class="detail-meta">
              <span v-if="detail.muscleGroup" class="meta-pill"><Icon name="lucide:target" /> {{ detail.muscleGroup }}</span>
              <span v-if="detail.equipment" class="meta-pill"><Icon name="lucide:dumbbell" /> {{ detail.equipment }}</span>
            </div>

            <ol v-if="detailSteps.length" class="steps">
              <li v-for="(s, i) in detailSteps" :key="i">{{ s }}</li>
            </ol>

            <div v-if="similar.length" class="similar">
              <span class="similar-title">Обычно в связке с</span>
              <div class="similar-row">
                <button v-for="s in similar" :key="s.id" type="button" class="similar-card" @click="openDetail(s.id)">
                  <img v-if="s.imageUrl" :src="s.imageUrl" :alt="s.name" loading="lazy" />
                  <Icon v-else name="lucide:dumbbell" class="similar-fallback" />
                  <span class="similar-name">{{ s.name }}</span>
                </button>
              </div>
            </div>

            <div class="sheet-actions">
              <AppButton v-if="!detail.source" icon="lucide:pencil" variant="ghost" @click="editFromDetail">Редактировать</AppButton>
              <p v-else class="builtin-note"><Icon name="lucide:lock" /> Встроенное упражнение — недоступно для правки</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Создание/правка -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="editing" class="sheet-backdrop" @click.self="closeEdit">
          <div class="sheet glass">
            <div class="sheet-head">
              <h2 class="sheet-title">{{ editing.id ? 'Упражнение' : 'Новое упражнение' }}</h2>
              <button type="button" class="sheet-close" @click="closeEdit"><Icon name="lucide:x" /></button>
            </div>

            <button type="button" class="image-pick" @click="fileInput?.click()">
              <img v-if="pickedPreview" :src="pickedPreview" alt="" class="image-preview" />
              <template v-else><Icon name="lucide:image-plus" /><span>Добавить фото</span></template>
            </button>
            <input ref="fileInput" type="file" accept="image/*" class="hidden-file" @change="onPickFile" />

            <label class="field">
              <span class="field-label">Название</span>
              <input v-model="editing.name" type="text" class="field-input" placeholder="Жим штанги лёжа" />
            </label>

            <label class="field">
              <span class="field-label">Категория</span>
              <select v-model="editing.categoryId" class="field-input">
                <option :value="null">— без категории —</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">Что качает (текст)</span>
              <input v-model="editing.muscleGroup" type="text" class="field-input" placeholder="Грудь, трицепс" />
            </label>

            <div class="sheet-actions">
              <AppButton icon="lucide:check" :disabled="saving" @click="save">Сохранить</AppButton>
              <button v-if="editing.id" type="button" class="del-btn" @click="removeExercise">Удалить упражнение</button>
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

.back, .head-action {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--muted);
  display: grid;
  place-items: center;
  font-size: 20px;
  cursor: pointer;
  &:active { color: var(--text); }
}
.head-action { margin-left: auto; }

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(20px, 5.4vw, 26px);
  color: var(--text);
}

.search {
  position: relative;
  flex-shrink: 0;
}
.search-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--muted);
}
.search-input {
  width: 100%;
  height: 44px;
  padding: 0 var(--space-3) 0 calc(var(--space-3) + 26px);
  border: 1px solid var(--glass-edge-flat);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text);
  font-size: 15px;
  &:focus { outline: none; border-color: var(--accent); }
}

.cat-manage { padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); flex-shrink: 0; }
.cat-add { display: flex; gap: var(--space-2); }
.cat-input {
  flex: 1; height: 38px; padding: 0 var(--space-3);
  border: 1px solid var(--glass-edge-flat); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text);
  &:focus { outline: none; border-color: var(--accent); }
}
.cat-add-btn {
  width: 38px; height: 38px; border: 0; border-radius: var(--radius-sm);
  background: var(--accent); color: var(--accent-text); display: grid; place-items: center; cursor: pointer;
}
.cat-row { display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: var(--text); }
.cat-del { width: 28px; height: 28px; border: 0; background: none; color: var(--muted); cursor: pointer; }

.chips {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: 2px;
  flex-shrink: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
.chip {
  flex-shrink: 0;
  min-height: 34px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-edge-flat);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  &.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
}

.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 calc(-1 * var(--space-4));
  padding: 0 var(--space-4) var(--space-4);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  text-align: left;
  cursor: pointer;
}
.thumb {
  aspect-ratio: 16 / 10;
  background: var(--surface-2);
  display: grid;
  place-items: center;
  overflow: hidden;
  img { width: 100%; height: 100%; object-fit: cover; }
}
.thumb-fallback { font-size: 30px; color: var(--muted); opacity: 0.5; }
.card-body { padding: var(--space-3); display: flex; flex-direction: column; gap: 2px; }
.card-name { font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.2; }
.card-sub { font-size: 12px; color: var(--muted); }

.empty { text-align: center; color: var(--muted); font-size: 14px; padding: var(--space-6) 0; }

.more {
  width: 100%;
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--glass-edge-flat);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  &:active { background: var(--surface); }
}

.fab {
  position: fixed;
  right: var(--space-4);
  bottom: calc(90px + env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  display: grid;
  place-items: center;
  font-size: 26px;
  box-shadow: var(--glass-shadow);
  cursor: pointer;
  z-index: 40;
  &:active { transform: scale(0.95); }
}

/* Sheet */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}
.sheet {
  width: 100%;
  max-width: 480px;
  padding: var(--space-5) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 88vh;
  overflow-y: auto;
}
.sheet-head { display: flex; align-items: center; justify-content: space-between; }
.sheet-title { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 19px; color: var(--text); }
.sheet-close { width: 32px; height: 32px; border: 0; border-radius: 50%; background: var(--surface-2); color: var(--muted); cursor: pointer; }

.image-pick {
  aspect-ratio: 16 / 9;
  border: 1px dashed var(--glass-edge-flat);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: 24px;
  cursor: pointer;
  overflow: hidden;
  span { font-size: 13px; }
}
.image-preview { width: 100%; height: 100%; object-fit: cover; }
.hidden-file { display: none; }

.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.field-input {
  height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-edge-flat);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text);
  font-size: 15px;
  &:focus { outline: none; border-color: var(--accent); }
}

.sheet-actions { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2); }
.del-btn {
  align-self: center;
  border: 0;
  background: none;
  color: #ff3b30;
  font-size: 14px;
  font-weight: 600;
  padding: var(--space-2);
  cursor: pointer;
}

.builtin-note {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  font-size: 13px;
  color: var(--muted);
}

.chips.muscles { margin-top: calc(-1 * var(--space-1)); }

.detail-image {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.detail-meta { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px var(--space-3);
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 13px;
  color: var(--text);
}

.steps {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: 14px;
  line-height: 1.4;
  color: var(--muted);
}

.similar { display: flex; flex-direction: column; gap: var(--space-2); }
.similar-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.similar-row {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
.similar-card {
  flex-shrink: 0;
  width: 96px;
  border: 0;
  padding: 0;
  border-radius: var(--radius-md);
  background: var(--surface-2);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  img { width: 96px; height: 64px; object-fit: cover; }
}
.similar-fallback { width: 96px; height: 64px; display: grid; place-items: center; font-size: 24px; color: var(--muted); }
.similar-name { padding: 6px; font-size: 11px; font-weight: 600; color: var(--text); line-height: 1.2; text-align: left; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.22s ease; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
