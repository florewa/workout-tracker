<script setup lang="ts">
// Карта тела: силуэт человека (вид спереди/сзади) с подсветкой целевых мышц
// по ключам free-exercise-db. Зоны мышц лежат поверх силуэта по контуру.
const props = defineProps<{ primary: string[]; secondary: string[] }>()

function tone(m: string): string {
  if (props.primary.includes(m)) return 'var(--accent)'
  if (props.secondary.includes(m)) return 'color-mix(in srgb, var(--accent) 38%, transparent)'
  return 'var(--muscle-base, color-mix(in srgb, var(--text) 12%, transparent))'
}

// Зоны мышц как пути по контуру тела (viewBox 0 0 200 440)
const FRONT: { m: string; d: string }[] = [
  // трапеции (шея→плечи)
  { m: 'traps', d: 'M86 70 Q100 64 114 70 L122 82 Q100 78 78 82 Z' },
  // дельты
  { m: 'shoulders', d: 'M74 84 Q60 84 56 100 Q54 112 62 116 Q72 104 80 92 Z' },
  { m: 'shoulders', d: 'M126 84 Q140 84 144 100 Q146 112 138 116 Q128 104 120 92 Z' },
  // грудные
  { m: 'chest', d: 'M82 90 Q98 96 99 120 Q86 124 78 114 Q74 100 82 90 Z' },
  { m: 'chest', d: 'M118 90 Q102 96 101 120 Q114 124 122 114 Q126 100 118 90 Z' },
  // бицепсы
  { m: 'biceps', d: 'M60 120 Q54 138 58 158 Q66 158 70 140 Q70 126 60 120 Z' },
  { m: 'biceps', d: 'M140 120 Q146 138 142 158 Q134 158 130 140 Q130 126 140 120 Z' },
  // предплечья
  { m: 'forearms', d: 'M56 162 Q50 184 52 206 Q60 206 64 184 Q66 168 56 162 Z' },
  { m: 'forearms', d: 'M144 162 Q150 184 148 206 Q140 206 136 184 Q134 168 144 162 Z' },
  // пресс
  { m: 'abdominals', d: 'M90 126 L110 126 Q112 150 108 180 Q100 186 92 180 Q88 150 90 126 Z' },
  // отводящие (внешняя поверхность бедра/таз)
  { m: 'abductors', d: 'M78 188 Q72 200 76 214 Q84 212 86 196 Z' },
  { m: 'abductors', d: 'M122 188 Q128 200 124 214 Q116 212 114 196 Z' },
  // квадрицепсы
  { m: 'quadriceps', d: 'M82 198 Q76 240 84 286 Q96 290 98 240 Q98 206 82 198 Z' },
  { m: 'quadriceps', d: 'M118 198 Q124 240 116 286 Q104 290 102 240 Q102 206 118 198 Z' },
  // приводящие (внутренняя поверхность)
  { m: 'adductors', d: 'M94 196 Q90 224 96 250 Q100 250 100 220 Z' },
  { m: 'adductors', d: 'M106 196 Q110 224 104 250 Q100 250 100 220 Z' },
  // икры (вид спереди — голень)
  { m: 'calves', d: 'M84 300 Q80 330 86 360 Q94 360 94 328 Q94 308 84 300 Z' },
  { m: 'calves', d: 'M116 300 Q120 330 114 360 Q106 360 106 328 Q106 308 116 300 Z' },
]

const BACK: { m: string; d: string }[] = [
  { m: 'traps', d: 'M84 70 Q100 62 116 70 Q120 92 100 100 Q80 92 84 70 Z' },
  { m: 'shoulders', d: 'M74 84 Q60 86 56 102 Q56 112 64 114 Q74 104 80 92 Z' },
  { m: 'shoulders', d: 'M126 84 Q140 86 144 102 Q144 112 136 114 Q126 104 120 92 Z' },
  { m: 'triceps', d: 'M60 118 Q54 138 58 158 Q66 158 70 138 Q70 124 60 118 Z' },
  { m: 'triceps', d: 'M140 118 Q146 138 142 158 Q134 158 130 138 Q130 124 140 118 Z' },
  // широчайшие
  { m: 'lats', d: 'M82 104 Q76 128 90 150 Q98 144 98 116 Q92 104 82 104 Z' },
  { m: 'lats', d: 'M118 104 Q124 128 110 150 Q102 144 102 116 Q108 104 118 104 Z' },
  // средняя спина (позвоночник/ромбовидные)
  { m: 'middle back', d: 'M94 102 L106 102 L104 150 L96 150 Z' },
  // поясница
  { m: 'lower back', d: 'M90 152 L110 152 Q112 170 100 182 Q88 170 90 152 Z' },
  { m: 'forearms', d: 'M56 162 Q50 184 52 206 Q60 206 64 184 Q66 168 56 162 Z' },
  { m: 'forearms', d: 'M144 162 Q150 184 148 206 Q140 206 136 184 Q134 168 144 162 Z' },
  // ягодицы
  { m: 'glutes', d: 'M82 186 Q74 200 80 216 Q94 220 98 200 Q96 188 82 186 Z' },
  { m: 'glutes', d: 'M118 186 Q126 200 120 216 Q106 220 102 200 Q104 188 118 186 Z' },
  // бицепс бедра
  { m: 'hamstrings', d: 'M84 220 Q78 256 86 292 Q96 294 98 252 Q98 226 84 220 Z' },
  { m: 'hamstrings', d: 'M116 220 Q122 256 114 292 Q104 294 102 252 Q102 226 116 220 Z' },
  // икры
  { m: 'calves', d: 'M84 300 Q78 330 86 362 Q96 362 96 326 Q96 306 84 300 Z' },
  { m: 'calves', d: 'M116 300 Q122 330 114 362 Q104 362 104 326 Q104 306 116 300 Z' },
]

// Силуэт тела (общий для обоих видов)
const SIL = 'M100 30 Q116 30 118 48 Q118 60 110 64 L122 72 Q146 78 150 104 '
  + 'L160 150 Q162 166 152 168 Q142 166 138 150 L132 112 L132 150 '
  + 'Q132 178 124 200 Q120 210 120 230 L116 300 Q114 350 108 390 '
  + 'Q104 398 100 398 Q96 398 92 390 Q86 350 84 300 L80 230 '
  + 'Q80 210 76 200 Q68 178 68 150 L68 112 L62 150 Q58 166 48 168 '
  + 'Q38 166 40 150 L50 104 Q54 78 78 72 L90 64 Q82 60 82 48 Q84 30 100 30 Z'
</script>

<template>
  <div class="map">
    <svg viewBox="0 0 200 410" class="body" aria-hidden="true">
      <path :d="SIL" class="sil" />
      <path v-for="(s, i) in FRONT" :key="'f' + i" :d="s.d" :fill="tone(s.m)" />
      <text x="100" y="408" class="lbl">спереди</text>
    </svg>
    <svg viewBox="0 0 200 410" class="body" aria-hidden="true">
      <path :d="SIL" class="sil" />
      <path v-for="(s, i) in BACK" :key="'b' + i" :d="s.d" :fill="tone(s.m)" />
      <text x="100" y="408" class="lbl">сзади</text>
    </svg>
  </div>
</template>

<style scoped lang="scss">
.map {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
}
.body {
  width: 47%;
  max-width: 150px;
  height: auto;
}
.sil {
  fill: var(--surface-2);
  stroke: color-mix(in srgb, var(--text) 14%, transparent);
  stroke-width: 1.5;
}
.lbl {
  fill: var(--muted);
  font-size: 13px;
  text-anchor: middle;
}
</style>
