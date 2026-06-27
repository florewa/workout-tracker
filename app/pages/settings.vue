<script setup lang="ts">
const theme = useThemeStore()
const session = useSessionStore()

const themeOptions = [
  { value: 'system', label: 'Система', icon: 'lucide:monitor' },
  { value: 'light', label: 'Светлая', icon: 'lucide:sun' },
  { value: 'dark', label: 'Тёмная', icon: 'lucide:moon' },
] as const
</script>

<template>
  <section class="page">
    <header class="head">
      <h1 class="screen-title">Профиль</h1>
    </header>

    <div v-if="session.currentUser" class="profile glass">
      <span class="avatar" :style="avatarGradient(session.currentUser.name)">
        {{ nameInitials(session.currentUser.name) }}
      </span>
      <div class="profile-info">
        <p class="profile-name">{{ session.currentUser.name }}</p>
        <p class="profile-sub">В зале</p>
      </div>
    </div>

    <div class="block">
      <h2 class="block-title">Тема</h2>
      <div class="seg glass">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          type="button"
          class="seg-btn"
          :class="{ active: theme.mode === opt.value }"
          @click="theme.setMode(opt.value)"
        >
          <Icon :name="opt.icon" class="seg-icon" />
          {{ opt.label }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.page {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-height: 100%;
}

.screen-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(22px, 6vw, 30px);
  line-height: 1.15;
  color: var(--text);
}

/* Profile card */
.profile {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 20px;
  color: #fff;
  flex-shrink: 0;
}

.profile-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.profile-sub {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--muted);
}

/* Settings block */
.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.block-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Segmented theme control */
.seg {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
}

.seg-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  @media (prefers-reduced-motion: no-preference) {
    transition: background 0.15s ease, color 0.15s ease;
  }

  .seg-icon {
    font-size: 17px;
  }

  &.active {
    background: var(--accent);
    color: var(--accent-text);
  }
}
</style>
