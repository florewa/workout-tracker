<script setup lang="ts">
defineProps<{ name: string; src?: string | null }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="avatar-preview">
      <div class="avatar-backdrop" role="dialog" aria-modal="true" :aria-label="`Аватар ${name}`" @click.self="emit('close')">
        <button type="button" class="avatar-close" aria-label="Закрыть" @click="emit('close')"><Icon name="lucide:x" /></button>
        <img v-if="src" :src="src" :alt="`Аватар ${name}`" class="avatar-image" />
        <UserAvatar v-else :name="name" :size="240" />
        <strong class="avatar-name">{{ name }}</strong>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.avatar-backdrop { position: fixed; inset: 0; z-index: 160; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 24px; background: rgba(0,0,0,.88); }
.avatar-image { width: min(82vw, 420px); height: min(82vw, 420px); max-height: 62dvh; border-radius: 50%; object-fit: cover; box-shadow: 0 20px 60px rgba(0,0,0,.45); }
.avatar-name { color: #fff; font-size: 20px; }
.avatar-close { position: absolute; top: calc(18px + env(safe-area-inset-top)); right: 18px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(255,255,255,.14); color: #fff; display: grid; place-items: center; font-size: 24px; }
.avatar-preview-enter-active, .avatar-preview-leave-active { transition: opacity .18s ease; }
.avatar-preview-enter-from, .avatar-preview-leave-to { opacity: 0; }
</style>
