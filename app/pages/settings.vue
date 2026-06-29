<script setup lang="ts">
interface UserLite { id: number; name: string }

const theme = useThemeStore()
const session = useSessionStore()
const api = useApi()
const { toast, confirm } = useDialog()

const themeOptions = [
  { value: 'system', label: 'Система', icon: 'lucide:monitor' },
  { value: 'light', label: 'Светлая', icon: 'lucide:sun' },
  { value: 'dark', label: 'Тёмная', icon: 'lucide:moon' },
] as const

const { data: friends, refresh: refreshFriends } = await useAsyncData(
  'friends-settings',
  () => api.get<UserLite[]>('/api/friends'),
  { server: false },
)

const inviting = ref(false)

async function invite() {
  if (inviting.value) return
  inviting.value = true
  try {
    const { link } = await api.get<{ token: string; link: string }>('/api/friends/invite')
    if (!link) { toast('Ссылка пока недоступна', 'error'); return }
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Тренируйся со мной')}`)
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(link)
      toast('Ссылка-приглашение скопирована', 'success')
    } else {
      toast(`Ссылка-приглашение: ${link}`, 'info')
    }
  } catch {
    toast('Не удалось создать приглашение', 'error')
  } finally {
    inviting.value = false
  }
}

async function removeFriend(id: number) {
  const ok = await confirm({
    title: 'Удалить из друзей?',
    message: 'Вы перестанете видеть друг друга в участниках и соревновании.',
    confirmText: 'Удалить',
    danger: true,
  })
  if (!ok) return
  try {
    await api.del(`/api/friends/${id}`)
    await refreshFriends()
  } catch {
    toast('Не удалось удалить', 'error')
  }
}
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
      <div class="block-head">
        <h2 class="block-title">Друзья</h2>
        <button type="button" class="invite-btn" :disabled="inviting" @click="invite">
          <Icon name="lucide:user-plus" />
          Пригласить
        </button>
      </div>
      <div v-if="friends && friends.length" class="friends glass">
        <div v-for="f in friends" :key="f.id" class="friend-row">
          <span class="friend-avatar" :style="avatarGradient(f.name)">{{ nameInitials(f.name) }}</span>
          <span class="friend-name">{{ f.name }}</span>
          <button type="button" class="friend-del" @click="removeFriend(f.id)">
            <Icon name="lucide:x" />
          </button>
        </div>
      </div>
      <p v-else class="friends-empty">
        Пока никого. Пригласи друга по ссылке — и сможете тренироваться вместе.
      </p>
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

/* Friends */
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.invite-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 0;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.friends {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.friend-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);

  &:not(:last-child) { border-bottom: 1px solid var(--glass-edge-flat); }
}

.friend-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 15px;
  color: #fff;
}

.friend-name {
  flex: 1;
  font-size: 15px;
  color: var(--text);
}

.friend-del {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  display: grid;
  place-items: center;
  font-size: 16px;
  cursor: pointer;

  &:active { color: var(--text); }
}

.friends-empty {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
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
