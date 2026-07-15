<script setup lang="ts">
const theme = useThemeStore()
const session = useSessionStore()
const startParam = useState<string>('tgStartParam', () => '')
const route = useRoute()
const api = useApi()
const { toast, confirm, confirmState } = useDialog()

interface WorkoutInvite {
  workoutId: number
  inviterId: number
  inviterName: string
  dayCode: string | null
  createdAt: string
}

let inviteTimer: ReturnType<typeof setInterval> | null = null
let checkingInvite = false

async function acceptWorkoutInvite(workoutId: number): Promise<boolean> {
  const res = await api.post<{ ok: boolean }>(`/api/workouts/invitations/${workoutId}`, { accept: true })
  if (!res.ok) return false
  await navigateTo(`/workout/${workoutId}`)
  return true
}

async function handleStartParam(): Promise<boolean> {
  if (!startParam.value) return false
  const value = startParam.value
  startParam.value = ''

  const workoutMatch = /^workout_(\d+)$/.exec(value)
  if (workoutMatch) {
    try {
      const ok = await acceptWorkoutInvite(Number(workoutMatch[1]))
      if (!ok) toast('Приглашение уже недоступно', 'error')
      return ok
    } catch {
      toast('Не удалось подключиться к тренировке', 'error')
      return false
    }
  }

  // Открыто по инвайт-ссылке — становимся друзьями с владельцем токена
  try {
    const res = await api.post<{ ok: boolean; friend?: { id: number; name: string } }>(
      '/api/friends/accept', { token: value },
    )
    if (res.ok && res.friend) toast(`Теперь вы друзья с ${res.friend.name}`, 'success')
  } catch { /* no-op */ }
  return false
}

async function checkWorkoutInvites() {
  if (
    checkingInvite
    || !session.currentUser
    || document.visibilityState === 'hidden'
    || route.path.startsWith('/workout/')
    || confirmState.open
  ) return

  checkingInvite = true
  try {
    const invites = await api.get<WorkoutInvite[]>('/api/workouts/invitations')
    const invite = invites[0]
    if (!invite) return

    const program = invite.dayCode ? ` «${invite.dayCode}»` : ''
    const accepted = await confirm({
      title: 'Совместная тренировка',
      message: `${invite.inviterName} приглашает тебя на тренировку${program}. Каждый записывает свои подходы сам.`,
      confirmText: 'Подключиться',
      cancelText: 'Отказаться',
    })
    const res = await api.post<{ ok: boolean }>(`/api/workouts/invitations/${invite.workoutId}`, { accept: accepted })
    if (!res.ok) {
      toast('Приглашение уже недоступно', 'error')
    } else if (accepted) {
      await navigateTo(`/workout/${invite.workoutId}`)
    } else {
      toast('Приглашение отклонено', 'info')
    }
  } catch { /* повторим при следующей проверке */ }
  finally { checkingInvite = false }
}

function checkWhenVisible() {
  if (document.visibilityState === 'visible') void checkWorkoutInvites()
}

onMounted(async () => {
  theme.init()
  try { await session.loadMe() } catch { /* покажем позже */ }
  const openedWorkout = await handleStartParam()
  if (!openedWorkout) await checkWorkoutInvites()
  inviteTimer = setInterval(() => { void checkWorkoutInvites() }, 8000)
  document.addEventListener('visibilitychange', checkWhenVisible)
  window.addEventListener('focus', checkWhenVisible)
})

onBeforeUnmount(() => {
  if (inviteTimer) clearInterval(inviteTimer)
  document.removeEventListener('visibilitychange', checkWhenVisible)
  window.removeEventListener('focus', checkWhenVisible)
})
</script>

<template>
  <div class="app">
    <main class="content"><slot /></main>
    <TabBar />
    <AppDialogHost />
  </div>
</template>

<style scoped lang="scss">
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}
.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* горизонтальные отступы задаёт сама страница — иначе они складываются вдвое,
     а overflow контента режет box-shadow карточек */
  padding-top: env(safe-area-inset-top);
  /* ровно высота таб-бара — без лишнего резерва, контент доходит до конца */
  padding-bottom: calc(64px + env(safe-area-inset-bottom));
}
</style>
