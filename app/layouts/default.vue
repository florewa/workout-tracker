<script setup lang="ts">
const theme = useThemeStore()
const session = useSessionStore()
const startParam = useState<string>('tgStartParam', () => '')
const { toast } = useDialog()

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
      if (res.ok && res.friend) toast(`Теперь вы друзья с ${res.friend.name}`, 'success')
    } catch { /* no-op */ }
  }
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
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  /* отступ под фиксированный таб-бар, чтобы контент не прятался за ним */
  padding-bottom: calc(78px + env(safe-area-inset-bottom));
}
</style>
