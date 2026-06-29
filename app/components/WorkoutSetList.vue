<script setup lang="ts">
interface SetItem { id: number; weight: number; reps: number; skipped?: boolean; variationName?: string | null }

const props = defineProps<{ sets: SetItem[] }>()
const emit = defineEmits<{
  (e: 'reorder', ids: number[]): void
  (e: 'edit', payload: { id: number; weight: number; reps: number }): void
  (e: 'remove', id: number): void
}>()

// Локальная копия для живой перестановки во время перетаскивания.
// Пока тащим — не пересинхронизируем с props, чтобы порядок не «прыгал».
const items = ref<SetItem[]>([])
const dragIndex = ref<number | null>(null)
watch(
  () => props.sets,
  (next) => { if (dragIndex.value === null) items.value = next.map(s => ({ ...s })) },
  { immediate: true, deep: true },
)

// ── Drag-and-drop (Pointer Events, работает на тач) ──
const GAP = 8
const dragY = ref(0)
let startY = 0
let rowH = 0

function onGripDown(e: PointerEvent, index: number) {
  if (editingId.value !== null) return
  dragIndex.value = index
  startY = e.clientY
  dragY.value = 0
  const li = (e.currentTarget as HTMLElement).closest('li')
  rowH = (li?.offsetHeight ?? 48) + GAP
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onGripMove(e: PointerEvent) {
  if (dragIndex.value === null) return
  let delta = e.clientY - startY
  // Пересекли половину соседней строки — меняем местами и сдвигаем базу.
  while (delta > rowH / 2 && dragIndex.value < items.value.length - 1) {
    const i = dragIndex.value
    ;[items.value[i], items.value[i + 1]] = [items.value[i + 1], items.value[i]]
    dragIndex.value = i + 1
    startY += rowH
    delta -= rowH
  }
  while (delta < -rowH / 2 && dragIndex.value > 0) {
    const i = dragIndex.value
    ;[items.value[i], items.value[i - 1]] = [items.value[i - 1], items.value[i]]
    dragIndex.value = i - 1
    startY -= rowH
    delta += rowH
  }
  dragY.value = delta
}

function onGripUp() {
  if (dragIndex.value === null) return
  const ids = items.value.map(s => s.id)
  const orig = props.sets.map(s => s.id)
  dragIndex.value = null
  dragY.value = 0
  if (ids.some((id, i) => id !== orig[i])) emit('reorder', ids)
}

// ── Inline-редактирование ──
const editingId = ref<number | null>(null)
const editWeight = ref(0)
const editReps = ref(0)

function startEdit(s: SetItem) {
  if (dragIndex.value !== null) return
  editingId.value = s.id
  editWeight.value = s.weight
  editReps.value = s.reps
}

function cancelEdit() { editingId.value = null }

function saveEdit(id: number) {
  const weight = Math.max(0, Number(editWeight.value) || 0)
  const reps = Math.max(0, Math.round(Number(editReps.value) || 0))
  editingId.value = null
  emit('edit', { id, weight, reps })
}
</script>

<template>
  <ul class="set-list">
    <li
      v-for="(s, i) in items"
      :key="s.id"
      class="set-row"
      :class="{ dragging: dragIndex === i }"
      :style="dragIndex === i ? { transform: `translateY(${dragY}px)`, zIndex: 2 } : null"
    >
      <button
        type="button"
        class="grip"
        aria-label="Перетащить"
        @pointerdown="onGripDown($event, i)"
        @pointermove="onGripMove"
        @pointerup="onGripUp"
        @pointercancel="onGripUp"
      >
        <Icon name="lucide:grip-vertical" />
      </button>

      <span class="set-idx">{{ i + 1 }}</span>

      <template v-if="editingId === s.id">
        <div class="edit-fields">
          <input
            v-model.number="editWeight"
            type="number"
            inputmode="decimal"
            step="2.5"
            min="0"
            class="edit-input"
            aria-label="Вес"
          />
          <span class="edit-mul">×</span>
          <input
            v-model.number="editReps"
            type="number"
            inputmode="numeric"
            step="1"
            min="0"
            class="edit-input"
            aria-label="Повторы"
          />
        </div>
        <button type="button" class="row-btn save" aria-label="Сохранить" @click="saveEdit(s.id)">
          <Icon name="lucide:check" />
        </button>
        <button type="button" class="row-btn" aria-label="Отмена" @click="cancelEdit">
          <Icon name="lucide:x" />
        </button>
      </template>

      <template v-else>
        <button type="button" class="set-val" :class="{ skipped: s.skipped }" @click="startEdit(s)">
          <template v-if="s.skipped">Пропуск</template>
          <template v-else>{{ s.weight }} × {{ s.reps }}</template>
          <em v-if="s.variationName" class="set-var">{{ s.variationName }}</em>
        </button>
        <button type="button" class="row-btn" aria-label="Изменить" @click="startEdit(s)">
          <Icon name="lucide:pencil" />
        </button>
        <button type="button" class="row-btn" aria-label="Удалить" @click="emit('remove', s.id)">
          <Icon name="lucide:x" />
        </button>
      </template>
    </li>
  </ul>
</template>

<style scoped lang="scss">
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
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-1);
  border-radius: var(--radius-md);
  background: var(--surface-2);

  &.dragging {
    position: relative;
    box-shadow: var(--glass-shadow);
    background: var(--surface);
    opacity: 0.97;
  }
}

.grip {
  flex-shrink: 0;
  width: 28px;
  height: 36px;
  border: 0;
  background: transparent;
  color: var(--muted);
  display: grid;
  place-items: center;
  font-size: 18px;
  cursor: grab;
  touch-action: none;

  &:active { cursor: grabbing; color: var(--text); }
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
  text-align: left;
  border: 0;
  background: transparent;
  color: var(--text);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;

  &.skipped { color: var(--muted); font-style: italic; font-weight: 600; }
}
.set-var { margin-left: 8px; font-style: normal; font-weight: 600; font-size: 12px; color: var(--muted); }

.edit-fields {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.edit-input {
  width: 100%;
  min-width: 0;
  height: 36px;
  border: 1px solid var(--glass-edge-flat);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  text-align: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  &:focus { outline: none; border-color: var(--accent); }
}

.edit-mul { color: var(--muted); font-weight: 700; }

.row-btn {
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
  &.save { color: var(--accent); }
}
</style>
