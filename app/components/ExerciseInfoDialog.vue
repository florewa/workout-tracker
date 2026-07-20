<script setup lang="ts">
interface ExerciseDetail {
  id: number
  name: string
  muscleGroup: string | null
  primaryMuscles: string[] | null
  secondaryMuscles: string[] | null
  equipment: string | null
  instructions: string | null
  imageUrl: string | null
  weightStep: number
}

const props = defineProps<{ exerciseId: number | null }>()
const emit = defineEmits<{ close: [] }>()
const api = useApi()
const detail = ref<ExerciseDetail | null>(null)
const loading = ref(false)

const steps = computed(() => (detail.value?.instructions ?? '').split('\n').map(item => item.trim()).filter(Boolean))

watch(() => props.exerciseId, async (id) => {
  detail.value = null
  if (id == null) return
  loading.value = true
  try {
    detail.value = await api.get<ExerciseDetail>(`/api/exercises/${id}`)
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <Transition name="info-sheet">
      <div v-if="exerciseId != null" class="info-backdrop" @click.self="emit('close')">
        <article class="info-sheet glass" role="dialog" aria-modal="true" aria-labelledby="exercise-info-title">
          <header class="info-head">
            <div>
              <span class="info-kicker">Об упражнении</span>
              <h2 id="exercise-info-title" class="info-title">{{ detail?.name ?? 'Упражнение' }}</h2>
            </div>
            <button type="button" class="info-close" aria-label="Закрыть" @click="emit('close')"><Icon name="lucide:x" /></button>
          </header>

          <div v-if="loading" class="info-loading"><Icon name="lucide:loader-circle" /> Загружаю</div>
          <template v-else-if="detail">
            <img v-if="detail.imageUrl" :src="detail.imageUrl" :alt="detail.name" class="info-image" />
            <MuscleMap
              v-if="detail.primaryMuscles?.length"
              :primary="detail.primaryMuscles"
              :secondary="detail.secondaryMuscles ?? []"
            />
            <div class="info-meta">
              <span v-if="detail.muscleGroup"><Icon name="lucide:target" /> {{ detail.muscleGroup }}</span>
              <span v-if="detail.equipment"><Icon name="lucide:dumbbell" /> {{ detail.equipment }}</span>
              <span><Icon name="lucide:plus-minus" /> Шаг {{ detail.weightStep }} кг</span>
            </div>
            <ol v-if="steps.length" class="info-steps">
              <li v-for="(step, index) in steps" :key="index">{{ step }}</li>
            </ol>
            <p v-else class="info-empty">Для этого упражнения пока нет инструкции.</p>
          </template>
          <p v-else class="info-empty">Не удалось загрузить информацию.</p>
        </article>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.info-backdrop {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, .62);
}
.info-sheet {
  width: min(100%, 560px);
  max-height: min(86dvh, 760px);
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.info-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.info-kicker { color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.info-title { margin: 4px 0 0; color: var(--text); font-family: var(--font-display); font-size: 24px; line-height: 1.15; }
.info-close { width: 42px; height: 42px; flex-shrink: 0; border: 0; border-radius: 50%; background: var(--surface-2); color: var(--text); display: grid; place-items: center; font-size: 22px; cursor: pointer; }
.info-image { width: 100%; max-height: 260px; object-fit: cover; border-radius: var(--radius-md); }
.info-meta { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.info-meta span { display: inline-flex; align-items: center; gap: 5px; padding: 7px 10px; border-radius: 999px; background: var(--surface-2); color: var(--muted); font-size: 13px; }
.info-steps { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: var(--space-2); color: var(--text); font-size: 14px; line-height: 1.5; }
.info-loading, .info-empty { margin: 0; padding: var(--space-5); text-align: center; color: var(--muted); }
.info-loading :deep(svg) { animation: spin .8s linear infinite; }
.info-sheet-enter-active, .info-sheet-leave-active { transition: opacity .18s ease; }
.info-sheet-enter-from, .info-sheet-leave-to { opacity: 0; }
.info-sheet-enter-active .info-sheet, .info-sheet-leave-active .info-sheet { transition: transform .2s ease; }
.info-sheet-enter-from .info-sheet, .info-sheet-leave-to .info-sheet { transform: translateY(100%); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
