<script setup lang="ts">
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function localIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

const ABBREVS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']

const weekDays = computed(() => {
  const today = new Date()
  const jsDay = today.getDay() // 0=Sun
  const mondayOffset = (jsDay + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const todayIso = localIso(today)

  return ABBREVS.map((abbrev, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = localIso(d)
    return { abbrev, dateNum: d.getDate(), iso, isToday: iso === todayIso }
  })
})
</script>

<template>
  <div class="strip" role="group" aria-label="Выбор дня недели">
    <button
      v-for="day in weekDays"
      :key="day.iso"
      class="cell"
      :class="{ 'cell--selected': day.iso === modelValue, 'cell--today': day.isToday && day.iso !== modelValue }"
      :aria-pressed="day.iso === modelValue"
      :aria-label="`${day.abbrev}, ${day.dateNum}`"
      @click="emit('update:modelValue', day.iso)"
    >
      <span class="abbrev">{{ day.abbrev }}</span>
      <span class="num-val">{{ day.dateNum }}</span>
      <span class="dot" :class="{ 'dot--hidden': !day.isToday, 'dot--selected': day.iso === modelValue }" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.strip {
  display: flex;
  gap: var(--space-1);
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.cell {
  flex: 1 0 0;
  min-width: 40px;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--space-2) var(--space-1) var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  user-select: none;
  position: relative;
  @media (prefers-reduced-motion: no-preference) {
    transition: background 0.12s, color 0.12s;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  &--selected {
    background: var(--accent);
    color: var(--accent-text);
  }

  &--today:not(.cell--selected) {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
}

.abbrev {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: inherit;
  opacity: 0.7;
  line-height: 1;
}

.num-val {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  color: inherit;
}

.dot {
  position: absolute;
  bottom: 7px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);

  &--hidden {
    visibility: hidden;
  }

  &--selected {
    background: var(--accent-text);
  }
}
</style>
