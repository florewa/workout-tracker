<script setup lang="ts">
interface ProgramDay {
  id: number
  code: string
  title: string
  order: number
  weekday: number | null
}

const props = defineProps<{
  day: ProgramDay
  count: number
  featured: boolean
}>()

const emit = defineEmits<{ select: [] }>()

const photoSrc = computed(() => programPhoto(props.day.code))

const muscles = computed(() => dayFocus(props.day.title))

const mins = computed(() => props.count * 10)
</script>

<template>
  <div class="card glass" :class="{ 'card--featured': featured }">
    <!-- Photo thumbnail -->
    <div class="thumb">
      <template v-if="photoSrc">
        <img :src="photoSrc" :alt="day.code" class="photo" />
        <div class="photo-overlay" aria-hidden="true" />
      </template>
      <div v-else class="photo-fallback" aria-hidden="true">
        <Icon name="lucide:dumbbell" class="fallback-icon" />
      </div>
    </div>

    <!-- Info -->
    <div class="info">
      <h3 class="title h2">{{ day.code }}</h3>
      <p v-if="muscles" class="muscles">{{ muscles }}</p>
      <div class="meta">
        <span class="meta-item">
          <Icon name="lucide:clock" class="meta-icon" />
          ~{{ mins }} мин
        </span>
        <span class="meta-item">
          <Icon name="lucide:dumbbell" class="meta-icon" />
          {{ count }} упр.
        </span>
      </div>
      <div class="btn-wrap">
        <AppButton
          :variant="featured ? 'accent' : 'ghost'"
          size="md"
          @click="emit('select')"
        >
          Выбрать
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  overflow: hidden;

  /* Accent left bar for the scheduled day — drawn as an inset edge so it
     survives the glass gradient border */
  &--featured {
    box-shadow: inset 4px 0 0 var(--accent), var(--glass-shadow);
  }
}

.thumb {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
}

.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 40%, rgba(0, 0, 0, 0.45));
  pointer-events: none;
}

.photo-fallback {
  width: 100%;
  height: 100%;
  background: var(--surface-2);
  display: grid;
  place-items: center;
  color: var(--muted);
}

.fallback-icon {
  font-size: 32px;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.title {
  margin: 0;
  color: var(--text);
  line-height: 1.2;
}

.muscles {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.meta {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: 2px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
  font-family: var(--font-mono);
}

.meta-icon {
  font-size: 13px;
}

.btn-wrap {
  margin-top: var(--space-2);
}
</style>
