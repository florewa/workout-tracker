<script setup lang="ts">
const route = useRoute()
const tabs = [
  { to: '/', label: 'Тренировка', icon: 'lucide:dumbbell', match: ['/', '/start', '/workout'] },
  { to: '/progress', label: 'Прогресс', icon: 'lucide:trending-up' },
  { to: '/history', label: 'История', icon: 'lucide:history' },
  { to: '/settings', label: 'Настройки', icon: 'lucide:settings' },
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
    <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab" :class="{ active: isActive(t) }">
      <Icon :name="t.icon" class="ic" />
      <span>{{ t.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped lang="scss">
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  border-top: 1px solid var(--glass-edge-flat);
  background: var(--surface);
  padding-bottom: env(safe-area-inset-bottom);
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .tabbar {
    /* Fading hairline — brighter in the middle, transparent at the edges */
    border-top: 1px solid transparent;
    border-image: linear-gradient(
      90deg,
      transparent,
      var(--glass-edge-flat) 20%,
      var(--glass-edge-flat) 80%,
      transparent
    ) 1;
    background: var(--glass-bg);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(140%);
    backdrop-filter: blur(var(--glass-blur)) saturate(140%);
  }
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
.ic {
  font-size: 22px;
  display: block;
  margin: 0 auto 3px;
}
</style>
