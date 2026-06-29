// Реестр живых WebSocket-подключений по тренировкам (singleton процесса, как db).
// REST-хендлеры подходов дёргают broadcast — клиенты в комнате обновляются.

interface RtPeer { id: string; send: (data: string) => void }
interface PeerInfo { workoutId: number; userId: number; name: string; peer: RtPeer }

const rooms = new Map<number, Set<string>>() // workoutId -> peerIds
const peers = new Map<string, PeerInfo>() // peerId -> info

export function joinRoom(peer: RtPeer, workoutId: number, userId: number, name: string): void {
  peers.set(peer.id, { workoutId, userId, name, peer })
  let set = rooms.get(workoutId)
  if (!set) { set = new Set(); rooms.set(workoutId, set) }
  set.add(peer.id)
}

export function leaveRoom(peerId: string): PeerInfo | null {
  const info = peers.get(peerId)
  if (!info) return null
  peers.delete(peerId)
  const set = rooms.get(info.workoutId)
  if (set) {
    set.delete(peerId)
    if (!set.size) rooms.delete(info.workoutId)
  }
  return info
}

// Уникальные участники, у кого есть хотя бы одно подключение
export function presence(workoutId: number): { userId: number; name: string }[] {
  const set = rooms.get(workoutId)
  if (!set) return []
  const seen = new Map<number, string>()
  for (const pid of set) {
    const info = peers.get(pid)
    if (info) seen.set(info.userId, info.name)
  }
  return [...seen.entries()].map(([userId, name]) => ({ userId, name }))
}

export function broadcast(workoutId: number, message: unknown): void {
  const set = rooms.get(workoutId)
  if (!set) return
  const data = JSON.stringify(message)
  for (const pid of set) {
    try { peers.get(pid)?.peer.send(data) } catch { /* peer мог отвалиться */ }
  }
}

export function broadcastPresence(workoutId: number): void {
  broadcast(workoutId, { type: 'presence', users: presence(workoutId) })
}

// Данные подходов изменились — участникам стоит перечитать тренировку
export function broadcastSetsChanged(workoutId: number): void {
  broadcast(workoutId, { type: 'sets-changed' })
}
