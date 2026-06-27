<script setup lang="ts">
interface MemberLite { id: number; name: string }
interface WorkoutData {
  workout: { id: number; date: string; dayId: number | null }
  members: MemberLite[]
  sets: { id: number }[]
}

const route = useRoute()
const api = useApi()
const id = Number(route.params.id)

const { data, refresh } = await useAsyncData(
  () => `workout-${id}`,
  () => api.get<WorkoutData>(`/api/workouts/${id}`),
  { server: false },
)

const hasSets = computed(() => (data.value?.sets.length ?? 0) > 0)
const busy = ref(false)

async function finish() {
  if (busy.value) return
  busy.value = true
  try {
    await api.patch(`/api/workouts/${id}`)
    navigateTo('/')
  } catch {
    alert('Не удалось завершить тренировку.')
    busy.value = false
  }
}

function chooseAnother() {
  navigateTo('/select')
}

async function cancel() {
  if (busy.value) return
  if (!confirm('Отменить тренировку? Она будет удалена.')) return
  busy.value = true
  try {
    await api.del(`/api/workouts/${id}`)
    navigateTo('/select')
  } catch (e) {
    const msg = (e as { statusMessage?: string })?.statusMessage
    alert(msg ?? 'Не удалось отменить тренировку.')
    busy.value = false
    refresh()
  }
}
</script>

<template>
  <section class="page">
    <header class="head">
      <h1 class="screen-title">Тренировка</h1>
      <div v-if="data?.members.length" class="members">
        <span v-for="m in data.members" :key="m.id" class="member">{{ m.name }}</span>
      </div>
    </header>

    <div class="stub glass">
      <Icon name="lucide:construction" class="stub-icon" aria-hidden="true" />
      <p class="stub-text">Экран записи подходов появится в M3b</p>
    </div>

    <div class="actions">
      <AppButton icon="lucide:check" variant="accent" :disabled="busy" @click="finish">
        Завершить
      </AppButton>
      <AppButton icon="lucide:list" variant="ghost" :disabled="busy" @click="chooseAnother">
        Выбрать другую
      </AppButton>
      <button
        v-if="!hasSets"
        type="button"
        class="cancel"
        :disabled="busy"
        @click="cancel"
      >
        Отменить тренировку
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.page {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-height: 100%;
}

.head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 30px);
  line-height: 1.15;
  color: var(--text);
}

.members {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.member {
  font-size: 14px;
  color: var(--muted);

  &:not(:last-child)::after {
    content: '·';
    margin-left: var(--space-2);
  }
}

.stub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  text-align: center;
  padding: var(--space-6) var(--space-4);
  min-height: 180px;
}

.stub-icon {
  font-size: 40px;
  color: var(--muted);
  opacity: 0.6;
}

.stub-text {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}

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

  &:active:not(:disabled) {
    color: var(--text);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
