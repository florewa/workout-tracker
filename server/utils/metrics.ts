function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function tonnage(weight: number, reps: number): number {
  return round1(weight * reps)
}

export function e1rm(weight: number, reps: number): number {
  return round1(weight * (1 + reps / 30))
}
