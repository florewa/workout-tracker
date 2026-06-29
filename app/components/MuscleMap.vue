<script setup lang="ts">
// Карта тела: реалистичный силуэт (спереди/сзади). Зоны мышц рисуются грубыми
// пятнами, но обрезаются по контуру тела (clipPath) — поэтому выглядят аккуратно.
const props = defineProps<{ primary: string[]; secondary: string[] }>()

interface Zone { m: string; cx: number; cy: number; rx: number; ry: number }

const FRONT: Zone[] = [
  { m: 'traps', cx: 100, cy: 92, rx: 22, ry: 9 },
  { m: 'shoulders', cx: 62, cy: 110, rx: 13, ry: 12 },
  { m: 'shoulders', cx: 138, cy: 110, rx: 13, ry: 12 },
  { m: 'chest', cx: 85, cy: 130, rx: 14, ry: 12 },
  { m: 'chest', cx: 115, cy: 130, rx: 14, ry: 12 },
  { m: 'biceps', cx: 53, cy: 165, rx: 8, ry: 18 },
  { m: 'biceps', cx: 147, cy: 165, rx: 8, ry: 18 },
  { m: 'forearms', cx: 50, cy: 222, rx: 8, ry: 20 },
  { m: 'forearms', cx: 150, cy: 222, rx: 8, ry: 20 },
  { m: 'abdominals', cx: 100, cy: 172, rx: 14, ry: 30 },
  { m: 'abductors', cx: 78, cy: 250, rx: 8, ry: 16 },
  { m: 'abductors', cx: 122, cy: 250, rx: 8, ry: 16 },
  { m: 'quadriceps', cx: 86, cy: 305, rx: 12, ry: 34 },
  { m: 'quadriceps', cx: 114, cy: 305, rx: 12, ry: 34 },
  { m: 'adductors', cx: 100, cy: 290, rx: 9, ry: 26 },
  { m: 'calves', cx: 88, cy: 388, rx: 9, ry: 24 },
  { m: 'calves', cx: 112, cy: 388, rx: 9, ry: 24 },
]

const BACK: Zone[] = [
  { m: 'traps', cx: 100, cy: 100, rx: 20, ry: 16 },
  { m: 'shoulders', cx: 62, cy: 110, rx: 12, ry: 11 },
  { m: 'shoulders', cx: 138, cy: 110, rx: 12, ry: 11 },
  { m: 'triceps', cx: 53, cy: 165, rx: 8, ry: 18 },
  { m: 'triceps', cx: 147, cy: 165, rx: 8, ry: 18 },
  { m: 'lats', cx: 82, cy: 150, rx: 11, ry: 18 },
  { m: 'lats', cx: 118, cy: 150, rx: 11, ry: 18 },
  { m: 'middle back', cx: 100, cy: 135, rx: 9, ry: 22 },
  { m: 'lower back', cx: 100, cy: 200, rx: 12, ry: 14 },
  { m: 'forearms', cx: 50, cy: 222, rx: 8, ry: 20 },
  { m: 'forearms', cx: 150, cy: 222, rx: 8, ry: 20 },
  { m: 'glutes', cx: 86, cy: 245, rx: 13, ry: 14 },
  { m: 'glutes', cx: 114, cy: 245, rx: 13, ry: 14 },
  { m: 'hamstrings', cx: 87, cy: 305, rx: 12, ry: 30 },
  { m: 'hamstrings', cx: 113, cy: 305, rx: 12, ry: 30 },
  { m: 'calves', cx: 88, cy: 388, rx: 9, ry: 24 },
  { m: 'calves', cx: 112, cy: 388, rx: 9, ry: 24 },
]

// Реалистичный силуэт человека (вид спереди, руки вдоль тела)
const SIL = 'M100 14 C112 14 121 23 121 38 C121 50 116 60 110 66 '
  + 'C109 70 108 73 108 77 C122 80 138 86 148 102 C154 113 153 128 151 140 '
  + 'C149 165 146 186 145 204 C144 224 144 240 144 252 C145 264 143 273 138 277 '
  + 'C134 280 130 276 129 267 C127 248 127 214 124 176 C122 150 120 132 117 120 '
  + 'C116 117 115 116 114 117 C116 142 117 168 115 192 C113 210 115 230 124 244 '
  + 'C130 253 132 262 132 276 C131 300 128 326 124 350 C122 372 120 392 117 408 '
  + 'C116 417 119 424 112 426 C106 427 102 423 101 415 C100 402 101 388 100 368 '
  + 'C100 345 100 322 100 300 C100 322 100 345 100 368 C99 388 100 402 99 415 '
  + 'C98 423 94 427 88 426 C81 424 84 417 83 408 C80 392 78 372 76 350 '
  + 'C72 326 69 300 68 276 C68 262 70 253 76 244 C85 230 87 210 85 192 '
  + 'C83 168 84 142 86 117 C85 116 84 117 83 120 C80 132 78 150 76 176 '
  + 'C73 214 73 248 71 267 C70 276 66 280 62 277 C57 273 55 264 56 252 '
  + 'C56 240 56 224 55 204 C54 186 51 165 49 140 C47 128 46 113 52 102 '
  + 'C62 86 78 80 92 77 C92 73 91 70 90 66 C84 60 79 50 79 38 C79 23 88 14 100 14 Z'

function tone(m: string): string {
  if (props.primary.includes(m)) return 'var(--accent)'
  if (props.secondary.includes(m)) return 'color-mix(in srgb, var(--accent) 42%, transparent)'
  return 'transparent'
}
const shown = (zones: Zone[]) => zones.filter(z => props.primary.includes(z.m) || props.secondary.includes(z.m))
</script>

<template>
  <div class="map">
    <svg viewBox="0 0 200 446" class="body" aria-hidden="true">
      <defs><clipPath id="mm-front"><path :d="SIL" /></clipPath></defs>
      <path :d="SIL" class="sil" />
      <g clip-path="url(#mm-front)">
        <ellipse v-for="(z, i) in shown(FRONT)" :key="i" :cx="z.cx" :cy="z.cy" :rx="z.rx" :ry="z.ry" :fill="tone(z.m)" />
      </g>
      <text x="100" y="442" class="lbl">спереди</text>
    </svg>
    <svg viewBox="0 0 200 446" class="body" aria-hidden="true">
      <defs><clipPath id="mm-back"><path :d="SIL" /></clipPath></defs>
      <path :d="SIL" class="sil" />
      <g clip-path="url(#mm-back)">
        <ellipse v-for="(z, i) in shown(BACK)" :key="i" :cx="z.cx" :cy="z.cy" :rx="z.rx" :ry="z.ry" :fill="tone(z.m)" />
      </g>
      <text x="100" y="442" class="lbl">сзади</text>
    </svg>
  </div>
</template>

<style scoped lang="scss">
.map { display: flex; justify-content: center; gap: var(--space-3); }
.body { width: 47%; max-width: 150px; height: auto; }
.sil {
  fill: var(--surface-2);
  stroke: color-mix(in srgb, var(--text) 30%, transparent);
  stroke-width: 1.6;
  stroke-linejoin: round;
}
.lbl { fill: var(--muted); font-size: 13px; text-anchor: middle; }
</style>
