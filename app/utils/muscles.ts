// RU-подписи мышц (ключи free-exercise-db) — для тегов, фильтра и схемы
export const MUSCLE_RU: Record<string, string> = {
  abdominals: 'Пресс',
  abductors: 'Отводящие',
  adductors: 'Приводящие',
  biceps: 'Бицепс',
  calves: 'Икры',
  chest: 'Грудь',
  forearms: 'Предплечья',
  glutes: 'Ягодицы',
  hamstrings: 'Бицепс бедра',
  lats: 'Широчайшие',
  'lower back': 'Поясница',
  'middle back': 'Средняя спина',
  neck: 'Шея',
  quadriceps: 'Квадрицепс',
  shoulders: 'Плечи',
  traps: 'Трапеции',
  triceps: 'Трицепс',
}

export function muscleRu(key: string): string {
  return MUSCLE_RU[key] ?? key
}

// Основные группы для фильтра (порядок «сверху вниз»)
export const FILTER_MUSCLES = [
  'chest', 'lats', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abdominals', 'quadriceps', 'hamstrings', 'glutes', 'calves',
  'traps', 'middle back', 'lower back',
]
