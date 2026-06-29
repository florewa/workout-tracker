// Локальная дата YYYY-MM-DD без UTC-сдвига: toISOString() уводит на TZ-offset
// и ломает совпадение дат подходов с днями недели у границы суток.
export function localIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// Короткий день недели: Пн, Вт, …
export function weekdayShort(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return WEEKDAY_SHORT[date.getDay()]
}

// Дата с префиксом дня недели: «Пн, 27 июня» (опционально с годом)
export function dateWithWeekday(d: Date | string, opts: { year?: boolean } = {}): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const body = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(opts.year ? { year: 'numeric' } : {}),
  }).format(date)
  return `${weekdayShort(date)}, ${body}`
}
