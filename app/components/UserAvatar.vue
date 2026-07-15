<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  src?: string | null
  size?: number
}>(), {
  src: null,
  size: 48,
})

const failed = ref(false)
watch(() => props.src, () => { failed.value = false })

const avatarStyle = computed(() => ({
  ...avatarGradient(props.name),
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(12, Math.round(props.size * 0.34))}px`,
}))
</script>

<template>
  <span class="user-avatar" :style="avatarStyle" aria-hidden="true">
    <img v-if="src && !failed" :src="src" alt="" loading="lazy" @error="failed = true" />
    <template v-else>{{ nameInitials(name) }}</template>
  </span>
</template>

<style scoped>
.user-avatar {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 50%;
  color: #fff;
  font-family: var(--font-display);
  font-weight: 800;
  line-height: 1;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
</style>
