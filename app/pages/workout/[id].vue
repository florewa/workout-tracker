<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <section>
    <h1>Тренировка #{{ route.params.id }}</h1>
    <p class="muted">Экран записи появится в M3b.</p>
  </section>
</template>

<style scoped lang="scss">
.muted { color: var(--muted); }
</style>
