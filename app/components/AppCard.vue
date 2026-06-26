<template>
  <div class="card"><slot /></div>
</template>

<style scoped lang="scss">
.card {
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
</style>
