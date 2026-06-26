<script setup lang="ts">
interface ProgramDay { id: number; code: string; title: string; order: number }
const api = useApi()
const session = useSessionStore()
const { data: days } = await useAsyncData('program-days', () => api.get<ProgramDay[]>('/api/program/days'), { server: false })
const selected = ref<ProgramDay | null>(null)
watchEffect(() => { if (days.value?.length && !selected.value) selected.value = days.value[0] })

function start() {
  if (session.currentUser) session.setMembers([session.currentUser.id])
  if (selected.value) navigateTo({ path: '/start', query: { dayId: selected.value.id } })
  else navigateTo('/start')
}
</script>

<template>
  <section class="page">
    <h1 class="greet h1">Сегодня</h1>

    <AppCard v-if="selected" class="day-card">
      <div class="day-header">
        <Icon name="lucide:flame" class="day-icon" />
        <span class="day-code h2">{{ selected.code }}</span>
      </div>
      <div class="day-title">{{ selected.title }}</div>
    </AppCard>

    <div v-if="days?.length" class="picker-wrap">
      <select v-model="selected" class="picker">
        <option v-for="d in days" :key="d.id" :value="d">{{ d.code }} — {{ d.title }}</option>
      </select>
      <Icon name="lucide:chevron-down" class="picker-arrow" />
    </div>

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

.greet {
  margin: 0;
  color: var(--text);
}

.day-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.day-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.day-icon {
  font-size: 22px;
  color: var(--accent);
  flex-shrink: 0;
}

.day-code {
  color: var(--accent);
}

.day-title {
  font-size: 16px;
  color: var(--text);
  line-height: 1.4;
}

.picker-wrap {
  position: relative;
}

.picker {
  width: 100%;
  min-height: 56px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--divider);
  border-radius: var(--radius-md);
  padding: 0 var(--space-6) 0 var(--space-4);
  font-size: 15px;
  appearance: none;
  cursor: pointer;
  outline: none;

  &:focus {
    border-color: var(--accent);
  }
}

.picker-arrow {
  position: absolute;
  right: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--muted);
  font-size: 18px;
}

.cta {
  margin-top: var(--space-2);
}
</style>
