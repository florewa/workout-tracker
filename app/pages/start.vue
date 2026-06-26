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
  <section class="page">
    <h1 class="screen-title h1">Кто сегодня в зале?</h1>
    <ul class="list">
      <li
        v-for="u in users"
        :key="u.id"
        class="row"
        :class="{ selected: isChecked(u.id) }"
        @click="session.toggleMember(u.id)"
      >
        <span class="avatar">{{ u.name.charAt(0).toUpperCase() }}</span>
        <span class="name">{{ u.name }}</span>
        <span class="check-circle" :class="{ active: isChecked(u.id) }">
          <Icon name="lucide:check" class="check-icon" />
        </span>
      </li>
    </ul>
    <div class="cta">
      <AppButton icon="lucide:arrow-right" :disabled="!session.selectedMemberIds.length" @click="go">Поехали</AppButton>
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

.screen-title {
  margin: 0;
  color: var(--text);
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-2) var(--space-1);
  cursor: pointer;
  border-bottom: 1px solid var(--divider);
  transition: background 0.1s;

  &:last-child {
    border-bottom: none;
  }
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text);
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.name {
  flex: 1;
  font-size: 16px;
  color: var(--text);
}

.check-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--divider);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
  color: transparent;

  .check-icon {
    font-size: 16px;
  }

  &.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }
}

.cta {
  margin-top: var(--space-2);
}
</style>
