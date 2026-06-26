<script setup lang="ts">
defineProps<{ variant?: 'accent' | 'ghost'; disabled?: boolean }>()
</script>

<template>
  <button :class="['btn', variant ?? 'accent']" :disabled="disabled">
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
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.accent { background: var(--accent); color: var(--accent-text); }
.ghost {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--divider);
}
</style>
