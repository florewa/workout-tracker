<script setup lang="ts">
interface UserLite { id: number; name: string }
const api = useApi()
const session = useSessionStore()
const route = useRoute()

const { data: users } = await useAsyncData('users', () => api.get<UserLite[]>('/api/users'), { server: false })
const dayId = computed(() => (route.query.dayId ? Number(route.query.dayId) : null))
const dateParam = computed(() => route.query.date as string | undefined)

const selectedCount = computed(() => session.selectedMemberIds.length)

function isChecked(id: number) { return session.selectedMemberIds.includes(id) }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.charAt(0) ?? ''
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return (first + second).toUpperCase()
}

// Deterministic accent-leaning gradient per person, so each avatar reads distinct
function avatarStyle(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return { background: `linear-gradient(135deg, hsl(${h} 64% 52%), hsl(${(h + 38) % 360} 66% 44%))` }
}

async function go() {
  try {
    const body: { dayId: number | null; memberIds: number[]; date?: string } = {
      dayId: dayId.value,
      memberIds: session.selectedMemberIds,
    }
    if (dateParam.value) body.date = dateParam.value
    const { id } = await api.post<{ id: number }>('/api/workouts', body)
    navigateTo(`/workout/${id}`)
  } catch {
    alert('Не удалось создать тренировку. Попробуй ещё раз.')
  }
}
</script>

<template>
  <section class="page">
    <header class="head">
      <h1 class="screen-title">Кто сегодня в зале?</h1>
      <p class="subtitle">Отметь, кто тренируется</p>
    </header>

    <div class="grid">
      <button
        v-for="u in users"
        :key="u.id"
        type="button"
        class="tile glass"
        :class="{ selected: isChecked(u.id) }"
        @click="session.toggleMember(u.id)"
      >
        <span class="check" aria-hidden="true">
          <Icon name="lucide:check" class="check-icon" />
        </span>
        <span class="avatar" :style="avatarStyle(u.name)">{{ initials(u.name) }}</span>
        <span class="name">{{ u.name }}</span>
      </button>
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
  flex-direction: column;
  gap: var(--space-1);
}

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 30px);
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

.cta {
  margin-top: auto;
}
</style>
