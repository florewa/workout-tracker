<script setup lang="ts">
interface ProgramDay { id: number; code: string; title: string; order: number }
const api = useApi()
const { data: days } = await useAsyncData('program-days', () => api.get<ProgramDay[]>('/api/program/days'), { server: false })
const selected = ref<ProgramDay | null>(null)
watchEffect(() => { if (days.value?.length && !selected.value) selected.value = days.value[0] })

function start() {
  if (selected.value) navigateTo({ path: '/start', query: { dayId: selected.value.id } })
  else navigateTo('/start')
}
</script>

<template>
  <section>
    <h1 class="greet display">Сегодня</h1>
    <div v-if="selected" class="day-card">
      <div class="code display">{{ selected.code }}</div>
      <div class="title">{{ selected.title }}</div>
    </div>
    <select v-if="days?.length" v-model="selected" class="picker">
      <option v-for="d in days" :key="d.id" :value="d">{{ d.code }} — {{ d.title }}</option>
    </select>
    <div class="cta"><AppButton @click="start">▶ Начать тренировку</AppButton></div>
  </section>
</template>

<style scoped lang="scss">
.greet { font-size: 24px; margin: 4px 0 16px; }
.day-card { background: var(--surface); border-radius: 16px; padding: 18px; margin-bottom: 12px; }
.code { color: var(--accent); font-weight: 700; font-size: 15px; }
.title { font-size: 18px; margin-top: 6px; }
.picker {
  width: 100%; min-height: 56px; margin-bottom: 16px;
  background: var(--surface); color: var(--text);
  border: 1px solid var(--divider); border-radius: 12px; padding: 0 12px;
}
.cta { margin-top: 8px; }
</style>
