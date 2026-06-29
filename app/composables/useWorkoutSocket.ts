interface PresenceUser { userId: number; name: string }

// Живая синхронизация совместной тренировки. Открывает WebSocket, авторизуется
// через initData, дёргает onChange на изменения подходов и держит presence.
export function useWorkoutSocket(workoutId: number, onChange: () => void) {
  const initData = useState<string>('tgInitData', () => '')
  const online = ref<PresenceUser[]>([])

  let ws: WebSocket | null = null
  let closedByUs = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function wsUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}/api/ws`
  }

  function connect() {
    try {
      ws = new WebSocket(wsUrl())
    } catch {
      scheduleReconnect()
      return
    }
    ws.onopen = () => ws?.send(JSON.stringify({ type: 'auth', initData: initData.value, workoutId }))
    ws.onmessage = (e) => {
      let msg: { type?: string; users?: PresenceUser[] }
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.type === 'sets-changed') onChange()
      else if (msg.type === 'presence') online.value = msg.users ?? []
    }
    ws.onclose = () => { online.value = []; scheduleReconnect() }
    ws.onerror = () => { try { ws?.close() } catch { /* no-op */ } }
  }

  function scheduleReconnect() {
    if (closedByUs) return
    reconnectTimer = setTimeout(connect, 2000)
  }

  onMounted(connect)
  onBeforeUnmount(() => {
    closedByUs = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    try { ws?.close() } catch { /* no-op */ }
  })

  return { online }
}
