<script setup lang="ts">
// Карта тела: реалистичный силуэт (спереди/сзади). Зоны мышц — грубые пятна,
// обрезаются по контуру тела (clipPath), поэтому выглядят аккуратно.
const props = defineProps<{ primary: string[]; secondary: string[] }>()

interface Zone { m: string; cx: number; cy: number; rx: number; ry: number }

const FRONT: Zone[] = [
  { m: 'traps', cx: 100, cy: 86, rx: 20, ry: 8 },
  { m: 'shoulders', cx: 62, cy: 104, rx: 12, ry: 11 },
  { m: 'shoulders', cx: 138, cy: 104, rx: 12, ry: 11 },
  { m: 'chest', cx: 86, cy: 120, rx: 13, ry: 11 },
  { m: 'chest', cx: 114, cy: 120, rx: 13, ry: 11 },
  { m: 'biceps', cx: 55, cy: 152, rx: 7, ry: 16 },
  { m: 'biceps', cx: 145, cy: 152, rx: 7, ry: 16 },
  { m: 'forearms', cx: 53, cy: 200, rx: 7, ry: 16 },
  { m: 'forearms', cx: 147, cy: 200, rx: 7, ry: 16 },
  { m: 'abdominals', cx: 100, cy: 158, rx: 13, ry: 28 },
  { m: 'abductors', cx: 80, cy: 212, rx: 7, ry: 14 },
  { m: 'abductors', cx: 120, cy: 212, rx: 7, ry: 14 },
  { m: 'quadriceps', cx: 86, cy: 278, rx: 11, ry: 34 },
  { m: 'quadriceps', cx: 114, cy: 278, rx: 11, ry: 34 },
  { m: 'adductors', cx: 92, cy: 252, rx: 6, ry: 22 },
  { m: 'adductors', cx: 108, cy: 252, rx: 6, ry: 22 },
  { m: 'calves', cx: 88, cy: 360, rx: 8, ry: 24 },
  { m: 'calves', cx: 112, cy: 360, rx: 8, ry: 24 },
]

const BACK: Zone[] = [
  { m: 'traps', cx: 100, cy: 96, rx: 19, ry: 15 },
  { m: 'shoulders', cx: 62, cy: 104, rx: 11, ry: 10 },
  { m: 'shoulders', cx: 138, cy: 104, rx: 11, ry: 10 },
  { m: 'triceps', cx: 55, cy: 152, rx: 7, ry: 16 },
  { m: 'triceps', cx: 145, cy: 152, rx: 7, ry: 16 },
  { m: 'lats', cx: 84, cy: 140, rx: 10, ry: 18 },
  { m: 'lats', cx: 116, cy: 140, rx: 10, ry: 18 },
  { m: 'middle back', cx: 100, cy: 124, rx: 8, ry: 20 },
  { m: 'lower back', cx: 100, cy: 186, rx: 11, ry: 13 },
  { m: 'forearms', cx: 53, cy: 200, rx: 7, ry: 16 },
  { m: 'forearms', cx: 147, cy: 200, rx: 7, ry: 16 },
  { m: 'glutes', cx: 87, cy: 216, rx: 12, ry: 14 },
  { m: 'glutes', cx: 113, cy: 216, rx: 12, ry: 14 },
  { m: 'hamstrings', cx: 87, cy: 282, rx: 11, ry: 30 },
  { m: 'hamstrings', cx: 113, cy: 282, rx: 11, ry: 30 },
  { m: 'calves', cx: 88, cy: 360, rx: 8, ry: 24 },
  { m: 'calves', cx: 112, cy: 360, rx: 8, ry: 24 },
]

// Силуэт человека: широкие плечи, узкий таз, пропорциональные ноги
const SIL = 'M100 16 C113 16 122 26 122 40 C122 52 116 60 110 64 '
  + 'C109 68 108 70 108 73 C124 76 140 82 148 100 C152 110 151 124 149 134 '
  + 'C147 152 145 168 144 182 C143 196 143 206 144 214 C145 222 143 228 138 230 '
  + 'C134 232 131 228 130 221 C128 205 128 175 126 150 C124 130 122 116 119 108 '
  + 'C118 106 117 106 116 107 C117 128 118 150 116 170 C114 184 116 196 124 206 '
  + 'C129 213 131 222 131 232 C130 256 128 282 125 306 C123 332 121 360 118 386 '
  + 'C117 396 120 404 113 406 C107 407 103 403 102 395 C101 382 102 366 101 344 '
  + 'C101 310 100 270 100 232 C100 270 99 310 99 344 C98 366 99 382 98 395 '
  + 'C97 403 93 407 87 406 C80 404 83 396 82 386 C79 360 77 332 75 306 '
  + 'C72 282 70 256 69 232 C69 222 71 213 76 206 C84 196 86 184 84 170 '
  + 'C82 150 83 128 84 107 C83 106 82 106 81 108 C78 116 76 130 74 150 '
  + 'C72 175 72 205 70 221 C69 228 66 232 62 230 C57 228 55 222 56 214 '
  + 'C57 206 57 196 56 182 C55 168 53 152 51 134 C49 124 48 110 52 100 '
  + 'C60 82 76 76 92 73 C92 70 91 68 90 64 C84 60 78 52 78 40 C78 26 87 16 100 16 Z'

function tone(m: string): string {
  if (props.primary.includes(m)) return 'var(--accent)'
  if (props.secondary.includes(m)) return 'color-mix(in srgb, var(--accent) 42%, transparent)'
  return 'transparent'
}
const shown = (zones: Zone[]) => zones.filter(z => props.primary.includes(z.m) || props.secondary.includes(z.m))
</script>

<template>
  <div class="map">
    <svg viewBox="0 0 200 426" class="body" aria-hidden="true">
      <defs><clipPath id="mm-front"><path :d="SIL" /></clipPath></defs>
      <path :d="SIL" class="sil" />
      <g clip-path="url(#mm-front)">
        <ellipse v-for="(z, i) in shown(FRONT)" :key="i" :cx="z.cx" :cy="z.cy" :rx="z.rx" :ry="z.ry" :fill="tone(z.m)" />
      </g>
      <text x="100" y="422" class="lbl">спереди</text>
    </svg>
    <svg viewBox="0 0 200 426" class="body" aria-hidden="true">
      <defs><clipPath id="mm-back"><path :d="SIL" /></clipPath></defs>
      <path :d="SIL" class="sil" />
      <g clip-path="url(#mm-back)">
        <ellipse v-for="(z, i) in shown(BACK)" :key="i" :cx="z.cx" :cy="z.cy" :rx="z.rx" :ry="z.ry" :fill="tone(z.m)" />
      </g>
      <text x="100" y="422" class="lbl">сзади</text>
    </svg>
  </div>
</template>

<style scoped lang="scss">
.map { display: flex; justify-content: center; gap: var(--space-3); }
.body { width: 46%; max-width: 140px; height: auto; }
.sil {
  fill: var(--surface-2);
  stroke: color-mix(in srgb, var(--text) 32%, transparent);
  stroke-width: 1.6;
  stroke-linejoin: round;
}
.lbl { fill: var(--muted); font-size: 13px; text-anchor: middle; }
</style>
