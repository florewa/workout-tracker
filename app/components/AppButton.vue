<script setup lang="ts">
defineProps<{ variant?: 'accent' | 'ghost'; size?: 'lg' | 'md'; icon?: string; disabled?: boolean }>()
</script>

<template>
  <button :class="['btn', variant ?? 'accent', size ?? 'lg']" :disabled="disabled">
    <Icon v-if="icon" :name="icon" class="ic" />
    <slot />
  </button>
</template>

<style scoped lang="scss">
.btn {
  width: 100%; display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); border: 0; border-radius: var(--radius-md);
  font-size: 17px; font-weight: 600; cursor: pointer; transition: transform .05s, opacity .15s;
  .ic { font-size: 20px; }
}
.lg { min-height: 56px; }
.md { min-height: 44px; font-size: 15px; }
.accent { background: var(--accent); color: var(--accent-text); }
.ghost { background: transparent; color: var(--text); border: 1px solid var(--divider); }
.btn:active:not(:disabled) { transform: scale(0.99); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
