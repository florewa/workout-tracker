<script setup lang="ts">
// Стилизованная схема тела: подсвечивает целевые группы мышц по ключам
// free-exercise-db (chest, lats, biceps, quadriceps, …). Не анатомический
// атлас, а понятная карта «куда грузим».
const props = defineProps<{ primary: string[]; secondary: string[] }>()

interface Shape { m: string; t: 'e' | 'r'; x: number; y: number; w: number; h: number }

// Вид спереди (viewBox 0..120 x 0..210)
const FRONT: Shape[] = [
  { m: 'neck', t: 'r', x: 54, y: 26, w: 12, h: 8 },
  { m: 'traps', t: 'e', x: 60, y: 36, w: 34, h: 10 },
  { m: 'shoulders', t: 'e', x: 38, y: 44, w: 18, h: 14 },
  { m: 'shoulders', t: 'e', x: 82, y: 44, w: 18, h: 14 },
  { m: 'chest', t: 'e', x: 50, y: 54, w: 18, h: 14 },
  { m: 'chest', t: 'e', x: 70, y: 54, w: 18, h: 14 },
  { m: 'biceps', t: 'e', x: 33, y: 66, w: 12, h: 20 },
  { m: 'biceps', t: 'e', x: 87, y: 66, w: 12, h: 20 },
  { m: 'abdominals', t: 'r', x: 52, y: 68, w: 16, h: 28 },
  { m: 'forearms', t: 'e', x: 28, y: 90, w: 11, h: 22 },
  { m: 'forearms', t: 'e', x: 92, y: 90, w: 11, h: 22 },
  { m: 'abductors', t: 'e', x: 47, y: 108, w: 8, h: 16 },
  { m: 'abductors', t: 'e', x: 73, y: 108, w: 8, h: 16 },
  { m: 'quadriceps', t: 'e', x: 50, y: 130, w: 15, h: 34 },
  { m: 'quadriceps', t: 'e', x: 70, y: 130, w: 15, h: 34 },
  { m: 'adductors', t: 'e', x: 60, y: 120, w: 10, h: 24 },
]

// Вид сзади
const BACK: Shape[] = [
  { m: 'traps', t: 'e', x: 60, y: 40, w: 30, h: 16 },
  { m: 'shoulders', t: 'e', x: 38, y: 46, w: 16, h: 12 },
  { m: 'shoulders', t: 'e', x: 82, y: 46, w: 16, h: 12 },
  { m: 'triceps', t: 'e', x: 33, y: 66, w: 12, h: 20 },
  { m: 'triceps', t: 'e', x: 87, y: 66, w: 12, h: 20 },
  { m: 'lats', t: 'e', x: 48, y: 62, w: 12, h: 22 },
  { m: 'lats', t: 'e', x: 72, y: 62, w: 12, h: 22 },
  { m: 'middle back', t: 'r', x: 54, y: 58, w: 12, h: 20 },
  { m: 'lower back', t: 'r', x: 53, y: 82, w: 14, h: 14 },
  { m: 'forearms', t: 'e', x: 28, y: 90, w: 11, h: 22 },
  { m: 'forearms', t: 'e', x: 92, y: 90, w: 11, h: 22 },
  { m: 'glutes', t: 'e', x: 51, y: 104, w: 14, h: 14 },
  { m: 'glutes', t: 'e', x: 69, y: 104, w: 14, h: 14 },
  { m: 'hamstrings', t: 'e', x: 51, y: 130, w: 14, h: 30 },
  { m: 'hamstrings', t: 'e', x: 69, y: 130, w: 14, h: 30 },
  { m: 'calves', t: 'e', x: 51, y: 172, w: 12, h: 24 },
  { m: 'calves', t: 'e', x: 69, y: 172, w: 12, h: 24 },
]

function tone(m: string): string {
  if (props.primary.includes(m)) return 'var(--accent)'
  if (props.secondary.includes(m)) return 'color-mix(in srgb, var(--accent) 40%, transparent)'
  return 'var(--surface-2)'
}
</script>

<template>
  <div class="map">
    <svg viewBox="0 0 120 210" class="body" aria-hidden="true">
      <ellipse cx="60" cy="16" rx="11" ry="12" fill="var(--surface-2)" />
      <template v-for="(s, i) in FRONT" :key="'f' + i">
        <ellipse v-if="s.t === 'e'" :cx="s.x" :cy="s.y" :rx="s.w / 2" :ry="s.h / 2" :fill="tone(s.m)" />
        <rect v-else :x="s.x" :y="s.y" :width="s.w" :height="s.h" rx="3" :fill="tone(s.m)" />
      </template>
    </svg>
    <svg viewBox="0 0 120 210" class="body" aria-hidden="true">
      <ellipse cx="60" cy="16" rx="11" ry="12" fill="var(--surface-2)" />
      <template v-for="(s, i) in BACK" :key="'b' + i">
        <ellipse v-if="s.t === 'e'" :cx="s.x" :cy="s.y" :rx="s.w / 2" :ry="s.h / 2" :fill="tone(s.m)" />
        <rect v-else :x="s.x" :y="s.y" :width="s.w" :height="s.h" rx="3" :fill="tone(s.m)" />
      </template>
    </svg>
  </div>
</template>

<style scoped lang="scss">
.map {
  display: flex;
  justify-content: center;
  gap: var(--space-4);
}
.body {
  width: 46%;
  max-width: 130px;
  height: auto;
}
</style>
