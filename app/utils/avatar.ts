// Initials + a deterministic gradient derived from a name — shared by the
// participant tiles and the profile screen so every person reads the same colour.

export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.charAt(0) ?? ''
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return (first + second).toUpperCase()
}

export function avatarGradient(name: string): { background: string } {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return { background: `linear-gradient(135deg, hsl(${h} 64% 52%), hsl(${(h + 38) % 360} 66% 44%))` }
}
