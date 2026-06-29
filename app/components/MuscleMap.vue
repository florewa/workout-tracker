<script setup lang="ts">
import { BODY_FRONT, BODY_BACK, BODY_VIEWBOX } from '~/utils/body-model'

// Подсветка целевых мышц на анатомическом теле (front/back).
const props = defineProps<{ primary: string[]; secondary: string[] }>()

// ключи free-exercise-db → slug'и модели тела
const MAP: Record<string, string[]> = {
  chest: ['chest'],
  shoulders: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  abdominals: ['abs', 'obliques'],
  traps: ['trapezius'],
  lats: ['upper-back'],
  'middle back': ['upper-back'],
  'lower back': ['lower-back'],
  quadriceps: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
  neck: ['neck'],
  adductors: ['adductors'],
}

function slugs(keys: string[]): Set<string> {
  const s = new Set<string>()
  for (const k of keys) for (const sl of MAP[k] ?? []) s.add(sl)
  return s
}
const primarySlugs = computed(() => slugs(props.primary))
const secondarySlugs = computed(() => slugs(props.secondary))

function fill(slug: string): string {
  if (primarySlugs.value.has(slug)) return 'var(--accent)'
  if (secondarySlugs.value.has(slug)) return 'color-mix(in srgb, var(--accent) 55%, #e9edf3)'
  return '#e9edf3'
}
</script>

<template>
  <div class="map">
    <svg :viewBox="BODY_VIEWBOX.front" class="body" aria-hidden="true">
      <g class="parts">
        <template v-for="part in BODY_FRONT" :key="part.slug">
          <path v-for="(d, i) in part.d" :key="part.slug + i" :d="d" :fill="fill(part.slug)" />
        </template>
      </g>
    </svg>
    <svg :viewBox="BODY_VIEWBOX.back" class="body" aria-hidden="true">
      <g class="parts">
        <template v-for="part in BODY_BACK" :key="part.slug">
          <path v-for="(d, i) in part.d" :key="part.slug + i" :d="d" :fill="fill(part.slug)" />
        </template>
      </g>
    </svg>
  </div>
</template>

<style scoped lang="scss">
.map {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
}
.body {
  width: 47%;
  max-width: 150px;
  height: auto;
}
.parts path {
  stroke: rgba(20, 24, 33, 0.35);
  stroke-width: 1.4;
  stroke-linejoin: round;
}
</style>
