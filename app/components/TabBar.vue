<script setup lang="ts">
const route = useRoute()
const tabs = [
  { to: '/', label: 'Тренировка', match: ['/', '/start', '/workout'] },
  { to: '/progress', label: 'Прогресс' },
  { to: '/history', label: 'История' },
  { to: '/settings', label: 'Настройки' },
]
function isActive(t: { to: string; match?: string[] }): boolean {
  const paths = t.match ?? [t.to]
  return paths.some((p) =>
    p === '/' ? route.path === '/' : route.path === p || route.path.startsWith(p + '/'),
  )
}
</script>

<template>
  <nav class="tabbar">
    <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab" :class="{ active: isActive(t) }">{{ t.label }}</NuxtLink>
  </nav>
</template>

<style scoped lang="scss">
.tabbar {
  display: flex;
  border-top: 1px solid var(--divider);
  background: var(--surface);
  padding-bottom: env(safe-area-inset-bottom);
}
.tab {
  flex: 1;
  text-align: center;
  padding: 12px 4px;
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  &.active { color: var(--accent); }
}
</style>
