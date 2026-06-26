<script setup lang="ts">
const theme = useThemeStore()
const session = useSessionStore()
onMounted(async () => {
  theme.init()
  try { await session.loadMe() } catch { /* покажем позже */ }
})
</script>

<template>
  <div class="app">
    <main class="content"><slot /></main>
    <TabBar />
  </div>
</template>

<style scoped lang="scss">
.app { display: flex; flex-direction: column; min-height: 100vh; }
.content {
  flex: 1;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  /* отступ под фиксированный таб-бар, чтобы контент не прятался за ним */
  padding-bottom: calc(78px + env(safe-area-inset-bottom));
}
</style>
