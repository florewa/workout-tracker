<script setup lang="ts">
const tabs = [
  { to: '/', label: 'Тренировка' },
  { to: '/progress', label: 'Прогресс' },
  { to: '/history', label: 'История' },
  { to: '/settings', label: 'Настройки' },
]
</script>

<template>
  <nav class="tabbar">
    <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab">
      {{ t.label }}
    </NuxtLink>
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
  &.router-link-exact-active { color: var(--accent); }
}
</style>
