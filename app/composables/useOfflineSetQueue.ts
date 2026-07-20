interface QueuedSetBody {
  workoutId: number
  userId: number
  exerciseId: number
  variationId?: number | null
  weight?: number
  reps?: number
  skipped?: boolean
  clientRequestId: string
}

interface QueuedSet {
  body: QueuedSetBody
  queuedAt: string
}

const STORAGE_KEY = 'workout-tracker:pending-sets:v1'

function isNetworkFailure(error: unknown): boolean {
  if (import.meta.client && !navigator.onLine) return true
  const candidate = error as { response?: { status?: number }; status?: number; statusCode?: number }
  return candidate.response?.status == null && candidate.status == null && candidate.statusCode == null
}

export function useOfflineSetQueue(onFlushed?: () => void | Promise<void>) {
  const api = useApi()
  const { toast } = useDialog()
  const queue = useState<QueuedSet[]>('offline-set-queue', () => [])
  const flushing = useState<boolean>('offline-set-queue-flushing', () => false)

  function persist() {
    if (import.meta.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.value))
  }

  function load() {
    if (!import.meta.client || queue.value.length) return
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
      if (Array.isArray(parsed)) queue.value = parsed
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  async function flush() {
    if (!import.meta.client || flushing.value || !navigator.onLine || !queue.value.length) return
    flushing.value = true
    let changed = false
    try {
      while (queue.value.length) {
        const item = queue.value[0]
        if (!item) break
        try {
          await api.post('/api/sets', { ...item.body })
          queue.value.shift()
          persist()
          changed = true
        } catch (error) {
          if (isNetworkFailure(error)) break
          // Невалидную после восстановления операцию не повторяем бесконечно.
          queue.value.shift()
          persist()
          toast('Одну отложенную запись сервер отклонил. Проверь тренировку.', 'error')
        }
      }
      if (changed) await onFlushed?.()
    } finally {
      flushing.value = false
    }
  }

  async function submit(body: Omit<QueuedSetBody, 'clientRequestId'>): Promise<{ queued: boolean }> {
    const clientRequestId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const operation = { ...body, clientRequestId }
    try {
      await api.post('/api/sets', operation)
      return { queued: false }
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      queue.value.push({ body: operation, queuedAt: new Date().toISOString() })
      persist()
      return { queued: true }
    }
  }

  onMounted(() => {
    load()
    window.addEventListener('online', flush)
    void flush()
  })
  onBeforeUnmount(() => window.removeEventListener('online', flush))

  return {
    submit,
    flush,
    pendingCount: computed(() => queue.value.length),
    pendingForWorkout: (workoutId: number) => computed(() => queue.value.filter(item => item.body.workoutId === workoutId).length),
  }
}
