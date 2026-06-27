<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <span class="chip" :class="{ active }"><slot /></span>
</template>

<style scoped lang="scss">
.chip {
  display: inline-flex; align-items: center; gap: var(--space-1);
  min-height: 40px; padding: 0 var(--space-3);
  border: 1px solid var(--glass-edge-flat); border-radius: 999px;
  color: var(--text); font-size: 15px;
  &.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .chip:not(.active) {
    border-color: transparent;
    background:
      linear-gradient(transparent, transparent) padding-box,
      var(--glass-edge) border-box;
  }
}
</style>
