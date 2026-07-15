<script setup lang="ts">
interface UserLite { id: number; name: string; avatarUrl: string | null }
interface DeletedWorkout {
  id: number
  date: string
  dayCode: string | null
  deletedAt: string
  expiresAt: string
  setCount: number
}

const theme = useThemeStore()
const session = useSessionStore()
const api = useApi()
const { toast, confirm } = useDialog()
const initData = useState<string>('tgInitData', () => '')

const themeOptions = [
  { value: 'system', label: 'Система', icon: 'lucide:monitor' },
  { value: 'light', label: 'Светлая', icon: 'lucide:sun' },
  { value: 'dark', label: 'Тёмная', icon: 'lucide:moon' },
] as const

const { data: friends, refresh: refreshFriends } = await useAsyncData(
  'friends-settings',
  () => api.get<UserLite[]>('/api/friends'),
  { server: false },
)
const { data: deletedWorkouts, refresh: refreshDeletedWorkouts } = await useAsyncData(
  'deleted-workouts',
  () => api.get<DeletedWorkout[]>('/api/workouts/trash'),
  { server: false },
)
const restoringWorkoutId = ref<number | null>(null)

function workoutDate(iso: string): string {
  return dateWithWeekday(iso, { year: true })
}

function daysUntilRemoval(expiresAt: string): number {
  return Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000))
}

function daysUntilRemovalLabel(expiresAt: string): string {
  const days = daysUntilRemoval(expiresAt)
  const mod10 = days % 10
  const mod100 = days % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня' : 'дней'
  return `${days} ${word}`
}

async function restoreDeletedWorkout(workout: DeletedWorkout) {
  if (restoringWorkoutId.value != null) return
  restoringWorkoutId.value = workout.id
  try {
    await api.post(`/api/workouts/${workout.id}/restore`)
    await refreshDeletedWorkouts()
    clearNuxtData('history')
    clearNuxtData('active-workout')
    clearNuxtData('competition')
    clearNuxtData('personal-progress')
    toast('Тренировка восстановлена', 'success')
  } catch (error) {
    toast((error as { statusMessage?: string }).statusMessage ?? 'Не удалось восстановить тренировку', 'error')
    await refreshDeletedWorkouts()
  } finally {
    restoringWorkoutId.value = null
  }
}

const inviting = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarSaving = ref(false)

async function pickAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || avatarSaving.value) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toast('Выбери JPG, PNG или WebP', 'error')
    input.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast('Файл должен быть меньше 5 МБ', 'error')
    input.value = ''
    return
  }

  avatarSaving.value = true
  try {
    const form = new FormData()
    form.append('avatar', file)
    const { avatarUrl } = await $fetch<{ avatarUrl: string }>('/api/me/avatar', {
      method: 'POST',
      headers: initData.value ? { Authorization: `tma ${initData.value}` } : {},
      body: form,
    })
    if (session.currentUser) session.currentUser = { ...session.currentUser, avatarUrl }
    toast('Аватар обновлён', 'success')
  } catch (error) {
    toast((error as { statusMessage?: string }).statusMessage ?? 'Не удалось загрузить аватар', 'error')
  } finally {
    avatarSaving.value = false
    input.value = ''
  }
}

async function removeAvatar() {
  if (!session.currentUser?.avatarUrl || avatarSaving.value) return
  const ok = await confirm({
    title: 'Удалить аватар?',
    message: 'Вместо фотографии снова будут показаны инициалы.',
    confirmText: 'Удалить',
    danger: true,
  })
  if (!ok) return
  avatarSaving.value = true
  try {
    await api.del('/api/me/avatar')
    session.currentUser = { ...session.currentUser, avatarUrl: null }
    toast('Аватар удалён', 'success')
  } catch {
    toast('Не удалось удалить аватар', 'error')
  } finally {
    avatarSaving.value = false
  }
}

async function invite() {
  if (inviting.value) return
  inviting.value = true
  try {
    const { link } = await api.get<{ token: string; link: string }>('/api/friends/invite')
    if (!link) { toast('Ссылка пока недоступна', 'error'); return }
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Тренируйся со мной')}`)
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(link)
      toast('Ссылка-приглашение скопирована', 'success')
    } else {
      toast(`Ссылка-приглашение: ${link}`, 'info')
    }
  } catch {
    toast('Не удалось создать приглашение', 'error')
  } finally {
    inviting.value = false
  }
}

const remindersOn = ref(true)
onMounted(async () => {
  try {
    const me = await api.get<{ remindersEnabled: boolean }>('/api/me')
    remindersOn.value = me.remindersEnabled
  } catch { /* оставим дефолт */ }
})
async function toggleReminders() {
  const next = !remindersOn.value
  remindersOn.value = next
  try {
    await api.patch('/api/me/reminders', { enabled: next })
  } catch {
    remindersOn.value = !next
    toast('Не удалось сохранить', 'error')
  }
}

async function removeFriend(id: number) {
  const ok = await confirm({
    title: 'Удалить из друзей?',
    message: 'Вы перестанете видеть друг друга в участниках и соревновании.',
    confirmText: 'Удалить',
    danger: true,
  })
  if (!ok) return
  try {
    await api.del(`/api/friends/${id}`)
    await refreshFriends()
  } catch {
    toast('Не удалось удалить', 'error')
  }
}
</script>

<template>
  <section class="page">
    <header class="head">
      <h1 class="screen-title">Профиль</h1>
    </header>

    <div v-if="session.currentUser" class="profile glass">
      <button type="button" class="avatar-button" :disabled="avatarSaving" aria-label="Изменить аватар" @click="avatarInput?.click()">
        <UserAvatar :name="session.currentUser.name" :src="session.currentUser.avatarUrl" :size="64" />
        <span class="avatar-edit" aria-hidden="true">
          <Icon :name="avatarSaving ? 'lucide:loader-circle' : 'lucide:camera'" :class="{ spinning: avatarSaving }" />
        </span>
      </button>
      <input ref="avatarInput" class="avatar-input" type="file" accept="image/jpeg,image/png,image/webp" @change="pickAvatar" />
      <div class="profile-info">
        <p class="profile-name">{{ session.currentUser.name }}</p>
        <button type="button" class="avatar-action" :disabled="avatarSaving" @click="avatarInput?.click()">
          {{ session.currentUser.avatarUrl ? 'Изменить фото' : 'Добавить фото' }}
        </button>
        <button v-if="session.currentUser.avatarUrl" type="button" class="avatar-remove" :disabled="avatarSaving" @click="removeAvatar">
          Удалить
        </button>
      </div>
    </div>

    <div class="block">
      <div class="block-head">
        <h2 class="block-title">Друзья</h2>
        <button type="button" class="invite-btn" :disabled="inviting" @click="invite">
          <Icon name="lucide:user-plus" />
          Пригласить
        </button>
      </div>
      <div v-if="friends && friends.length" class="friends glass">
        <div v-for="f in friends" :key="f.id" class="friend-row">
          <UserAvatar :name="f.name" :src="f.avatarUrl" :size="38" />
          <span class="friend-name">{{ f.name }}</span>
          <button type="button" class="friend-del" @click="removeFriend(f.id)">
            <Icon name="lucide:x" />
          </button>
        </div>
      </div>
      <p v-else class="friends-empty">
        Пока никого. Пригласи друга по ссылке — и сможете тренироваться вместе.
      </p>
    </div>

    <div class="block">
      <div class="block-head">
        <h2 class="block-title">Корзина</h2>
        <span class="trash-retention">Хранение 7 дней</span>
      </div>
      <div v-if="deletedWorkouts?.length" class="trash-list glass">
        <div v-for="workout in deletedWorkouts" :key="workout.id" class="trash-row">
          <span class="trash-icon"><Icon name="lucide:trash-2" /></span>
          <div class="trash-info">
            <span class="trash-title">{{ workout.dayCode ?? 'Тренировка' }}</span>
            <span class="trash-meta">{{ workoutDate(workout.date) }} · {{ workout.setCount }} подх.</span>
            <span class="trash-expiry">Удалится через {{ daysUntilRemovalLabel(workout.expiresAt) }}</span>
          </div>
          <button
            type="button"
            class="restore-btn"
            :disabled="restoringWorkoutId != null"
            @click="restoreDeletedWorkout(workout)"
          >
            <Icon :name="restoringWorkoutId === workout.id ? 'lucide:loader-circle' : 'lucide:rotate-ccw'" :class="{ spinning: restoringWorkoutId === workout.id }" />
            Восстановить
          </button>
        </div>
      </div>
      <div v-else class="row glass">
        <div class="row-text">
          <span class="row-title">Корзина пуста</span>
          <span class="row-sub">Удалённые тренировки появятся здесь</span>
        </div>
        <Icon name="lucide:trash-2" class="empty-trash-icon" />
      </div>
    </div>

    <div class="block">
      <h2 class="block-title">Уведомления</h2>
      <div class="row glass">
        <div class="row-text">
          <span class="row-title">Напоминания о тренировке</span>
          <span class="row-sub">Бот напомнит в дни по программе</span>
        </div>
        <button
          type="button"
          class="switch"
          :class="{ on: remindersOn }"
          role="switch"
          :aria-checked="remindersOn"
          @click="toggleReminders"
        >
          <span class="knob" />
        </button>
      </div>
    </div>

    <div class="block">
      <h2 class="block-title">Тема</h2>
      <div class="seg glass">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          type="button"
          class="seg-btn"
          :class="{ active: theme.mode === opt.value }"
          @click="theme.setMode(opt.value)"
        >
          <Icon :name="opt.icon" class="seg-icon" />
          {{ opt.label }}
        </button>
      </div>
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

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 30px);
  line-height: 1.15;
  color: var(--text);
}

/* Profile card */
.profile {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
}

.avatar-button { position: relative; flex-shrink: 0; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer; }
.avatar-button:disabled { cursor: wait; }
.avatar-edit {
  position: absolute; right: -2px; bottom: -2px; width: 24px; height: 24px;
  display: grid; place-items: center; border: 2px solid var(--surface); border-radius: 50%;
  background: var(--accent); color: var(--accent-text); font-size: 12px;
}
.avatar-input { display: none; }
.profile-info { flex: 1; min-width: 0; display: flex; align-items: baseline; flex-wrap: wrap; column-gap: var(--space-2); }

.profile-name {
  flex-basis: 100%;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.avatar-action, .avatar-remove { border: 0; background: none; padding: 3px 0; font-size: 12px; font-weight: 600; cursor: pointer; }
.avatar-action { color: var(--accent); }
.avatar-remove { color: var(--muted); }
.avatar-action:disabled, .avatar-remove:disabled { opacity: .55; cursor: wait; }
.spinning { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Settings block */
.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Toggle row */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.row-title { font-size: 15px; font-weight: 600; color: var(--text); }
.row-sub { font-size: 12px; color: var(--muted); }

.switch {
  flex-shrink: 0;
  width: 48px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: var(--surface-2);
  padding: 3px;
  cursor: pointer;

  @media (prefers-reduced-motion: no-preference) {
    transition: background 0.18s ease;
  }

  &.on { background: var(--accent); }
}

.knob {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;

  @media (prefers-reduced-motion: no-preference) {
    transition: transform 0.18s ease;
  }

  .switch.on & { transform: translateX(20px); }
}

.block-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Friends */
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.invite-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 0;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.friends {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.friend-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);

  &:not(:last-child) { border-bottom: 1px solid var(--glass-edge-flat); }
}

.friend-name {
  flex: 1;
  font-size: 15px;
  color: var(--text);
}

.friend-del {
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
}

.friends-empty {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
}

/* Workout trash */
.trash-retention { font-size: 12px; color: var(--muted); }
.trash-list { display: flex; flex-direction: column; overflow: hidden; }
.trash-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);

  &:not(:last-child) { border-bottom: 1px solid var(--glass-edge-flat); }
}
.trash-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--muted);
  display: grid;
  place-items: center;
}
.trash-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.trash-title { color: var(--text); font-size: 14px; font-weight: 700; }
.trash-meta, .trash-expiry { color: var(--muted); font-size: 11px; }
.trash-expiry { color: var(--accent); }
.restore-btn {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-2));
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.55; cursor: wait; }
}
.empty-trash-icon { flex-shrink: 0; color: var(--muted); font-size: 20px; }

/* Segmented theme control */
.seg {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
}

.seg-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  @media (prefers-reduced-motion: no-preference) {
    transition: background 0.15s ease, color 0.15s ease;
  }

  .seg-icon {
    font-size: 17px;
  }

  &.active {
    background: var(--accent);
    color: var(--accent-text);
  }
}
</style>
