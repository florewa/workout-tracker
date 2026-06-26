<script setup lang="ts">
defineProps<{ variant?: 'accent' | 'ghost' }>()
</script>

<template>
  <button :class="['btn', variant ?? 'accent']">
    <slot />
  </button>
</template>

<style scoped lang="scss">
.btn {
  width: 100%;
  min-height: 56px;
  border: 0;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
}
.accent { background: var(--accent); color: var(--accent-text); }
.ghost {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--divider);
}
</style>
