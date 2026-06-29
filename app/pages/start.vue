<script setup lang="ts">
interface UserLite { id: number; name: string }
const api = useApi()
const session = useSessionStore()
const route = useRoute()
const { toast } = useDialog()

const { data: friends } = await useAsyncData('friends', () => api.get<UserLite[]>('/api/friends'), { server: false })
const dayId = computed(() => (route.query.dayId ? Number(route.query.dayId) : null))
const dateParam = computed(() => route.query.date as string | undefined)

onMounted(async () => { if (!session.currentUser) { try { await session.loadMe() } catch { /* no-op */ } } })

// Я + мои друзья
const people = computed<UserLite[]>(() => {
  const self = session.currentUser
  const list = friends.value ?? []
  return self ? [self, ...list.filter(f => f.id !== self.id)] : list
})

const selectedCount = computed(() => session.selectedMemberIds.length)

function isChecked(id: number) { return session.selectedMemberIds.includes(id) }

function goBack() { navigateTo('/select') }

const recordMode = ref<'single' | 'each'>('single')

async function go() {
  try {
    const multi = session.selectedMemberIds.length >= 2
    const body: { dayId: number | null; memberIds: number[]; date?: string; recordMode?: string } = {
      dayId: dayId.value,
      memberIds: session.selectedMemberIds,
      recordMode: multi ? recordMode.value : 'each',
    }
    if (dateParam.value) body.date = dateParam.value
    const { id } = await api.post<{ id: number }>('/api/workouts', body)
    navigateTo(`/workout/${id}`)
  } catch {
    toast('Не удалось создать тренировку. Попробуй ещё раз.', 'error')
  }
}
</script>

<template>
  <section class="page">
    <header class="head">
      <button type="button" class="back" aria-label="Назад" @click="goBack">
        <Icon name="lucide:arrow-left" />
      </button>
      <div class="head-text">
        <h1 class="screen-title">Кто сегодня в зале?</h1>
        <p class="subtitle">Отметь, кто тренируется</p>
      </div>
    </header>

    <div class="grid">
      <button
        v-for="u in people"
        :key="u.id"
        type="button"
        class="tile glass"
        :class="{ selected: isChecked(u.id) }"
        @click="session.toggleMember(u.id)"
      >
        <span class="check" aria-hidden="true">
          <Icon name="lucide:check" class="check-icon" />
        </span>
        <span class="avatar" :style="avatarGradient(u.name)">{{ nameInitials(u.name) }}</span>
        <span class="name">{{ u.name }}</span>
      </button>
    </div>

    <button v-if="people.length <= 1" type="button" class="add-friends" @click="navigateTo('/settings')">
      <Icon name="lucide:user-plus" />
      Добавь друзей, чтобы тренироваться вместе
    </button>

    <div v-if="selectedCount >= 2" class="mode">
      <span class="mode-label">Кто записывает</span>
      <div class="seg">
        <button type="button" class="seg-btn" :class="{ active: recordMode === 'single' }" @click="recordMode = 'single'">
          Я за всех
        </button>
        <button type="button" class="seg-btn" :class="{ active: recordMode === 'each' }" @click="recordMode = 'each'">
          Каждый сам
        </button>
      </div>
      <p class="mode-hint">
        {{ recordMode === 'single'
          ? 'Подходы по очереди: записал за одного — курсор сам встанет на следующего.'
          : 'Каждый отмечает свои подходы сам (переключение участников вручную).' }}
      </p>
    </div>

    <div class="cta">
      <AppButton icon-end="lucide:move-right" :disabled="!selectedCount" @click="go">
        Поехали
      </AppButton>
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
  align-items: center;
  gap: var(--space-3);
}

.head-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.back {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 0;
  background: none;
  display: grid;
  place-items: center;
  font-size: 22px;
  color: var(--muted);
  cursor: pointer;

  @media (prefers-reduced-motion: no-preference) {
    transition: transform 0.08s ease, color 0.12s ease;
  }

  &:active { transform: scale(0.9); }
  &:hover { color: var(--text); }
}

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(20px, 5.4vw, 26px);
  line-height: 1.15;
  color: var(--text);
}

.subtitle {
  margin: 0;
  font-size: 15px;
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

/* Selectable member tile (.glass provides the surface + edge) */
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-3);
  cursor: pointer;
  color: var(--text);

  @media (prefers-reduced-motion: no-preference) {
    transition: transform 0.08s ease, box-shadow 0.15s ease;
  }

  &:active {
    transform: scale(0.98);
  }

  &.selected {
    box-shadow: inset 0 0 0 2px var(--accent), var(--glass-shadow);
  }
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 22px;
  color: #fff;
  flex-shrink: 0;
}

.name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text);
}

/* Check badge — hidden until the tile is selected */
.check {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  display: grid;
  place-items: center;
  opacity: 0;
  transform: scale(0.6);

  .check-icon {
    font-size: 15px;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
}

.tile.selected .check {
  opacity: 1;
  transform: scale(1);
}

.add-friends {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 0;
  background: none;
  font-size: 14px;
  color: var(--muted);
  cursor: pointer;

  &:active { color: var(--text); }
}

.mode {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mode-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.seg-btn {
  flex: 1;
  min-height: 40px;
  border: 0;
  border-radius: calc(var(--radius-md) - 4px);
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  @media (prefers-reduced-motion: no-preference) {
    transition: background 0.15s ease, color 0.15s ease;
  }

  &.active { background: var(--accent); color: var(--accent-text); }
}

.mode-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.3;
  color: var(--muted);
}

.cta {
  margin-top: auto;
}
</style>
