const PROGRAM_PHOTO: Record<string, string> = {
  'Верх A': '/programs/upper-a.jpg',
  'Низ A': '/programs/lower-a.jpg',
  'Верх B': '/programs/upper-b.jpg',
  'Низ B': '/programs/lower-b.jpg',
}

export function programPhoto(code: string): string | null {
  return PROGRAM_PHOTO[code] ?? null
}

// Фокус дня из заголовка "ДЕНЬ 1 · ВЕРХ A (грудь, спина)" → "грудь, спина"
export function dayFocus(title: string): string {
  const m = title.match(/\(([^)]+)\)/)
  return m ? m[1].trim() : ''
}
