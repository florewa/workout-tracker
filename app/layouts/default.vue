<script setup lang="ts">
const theme = useThemeStore()
const session = useSessionStore()
const startParam = useState<string>('tgStartParam', () => '')
const friendToast = ref('')

onMounted(async () => {
  theme.init()
  try { await session.loadMe() } catch { /* покажем позже */ }

  // Открыто по инвайт-ссылке — становимся друзьями с владельцем токена
  if (startParam.value) {
    const token = startParam.value
    startParam.value = ''
    try {
      const res = await useApi().post<{ ok: boolean; friend?: { id: number; name: string } }>(
        '/api/friends/accept', { token },
      )
      if (res.ok && res.friend) {
        friendToast.value = res.friend.name
        setTimeout(() => { friendToast.value = '' }, 4000)
      }
    } catch { /* no-op */ }
  }
})
</script>

<template>
  <div class="app">
    <main class="content"><slot /></main>
    <TabBar />
    <Transition name="toast">
      <div v-if="friendToast" class="toast glass">
        <Icon name="lucide:user-plus" class="toast-icon" />
        <span>Теперь вы друзья с <b>{{ friendToast }}</b></span>
      </div>
    </Transition>
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
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  /* отступ под фиксированный таб-бар, чтобы контент не прятался за ним */
  padding-bottom: calc(78px + env(safe-area-inset-bottom));
}

.toast {
  position: fixed;
  left: 50%;
  bottom: calc(86px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: calc(100% - var(--space-5));
  padding: var(--space-3) var(--space-4);
  font-size: 14px;
  color: var(--text);
  white-space: nowrap;

  b { color: var(--accent); }
  .toast-icon { font-size: 18px; color: var(--accent); flex-shrink: 0; }
}

.toast-enter-active,
.toast-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translate(-50%, 8px); }
</style>
