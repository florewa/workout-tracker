<script setup lang="ts">
interface UserLite { id: number; name: string }
const api = useApi()
const session = useSessionStore()
const route = useRoute()

const { data: users } = await useAsyncData('users', () => api.get<UserLite[]>('/api/users'), { server: false })
const dayId = computed(() => (route.query.dayId ? Number(route.query.dayId) : null))

function isChecked(id: number) { return session.selectedMemberIds.includes(id) }

async function go() {
  try {
    const { id } = await api.post<{ id: number }>('/api/workouts', {
      dayId: dayId.value,
      memberIds: session.selectedMemberIds,
    })
    navigateTo(`/workout/${id}`)
  } catch {
    alert('Не удалось создать тренировку. Попробуй ещё раз.')
  }
}
</script>

<template>
  <section>
    <h1 class="title h1">Кто сегодня в зале?</h1>
    <ul class="list">
      <li v-for="u in users" :key="u.id" class="row" @click="session.toggleMember(u.id)">
        <span class="box" :class="{ on: isChecked(u.id) }">{{ isChecked(u.id) ? '✓' : '' }}</span>
        <span>{{ u.name }}</span>
      </li>
    </ul>
    <div class="cta">
      <AppButton :disabled="!session.selectedMemberIds.length" @click="go">Поехали →</AppButton>
    </div>
  </section>
</template>

<style scoped lang="scss">
.title { font-size: 22px; margin: 4px 0 16px; }
.list { list-style: none; padding: 0; margin: 0 0 16px; }
.row {
  display: flex; align-items: center; gap: 12px;
  min-height: 56px; padding: 0 4px; cursor: pointer;
  border-bottom: 1px solid var(--divider);
}
.box {
  width: 26px; height: 26px; border-radius: 7px;
  border: 1px solid var(--divider); display: grid; place-items: center;
  color: var(--accent-text);
  &.on { background: var(--accent); border-color: var(--accent); }
}
.cta { margin-top: 8px; }
</style>
