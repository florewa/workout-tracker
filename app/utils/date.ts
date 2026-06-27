// Локальная дата YYYY-MM-DD без UTC-сдвига: toISOString() уводит на TZ-offset
// и ломает совпадение дат подходов с днями недели у границы суток.
export function localIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}
