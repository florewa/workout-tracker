import { defineWebSocketHandler } from 'h3'
import { db } from '~~/server/db/client'
import { authenticateInitData } from '~~/server/utils/auth'
import { isWorkoutMember } from '~~/server/services/workouts'
import { joinRoom, leaveRoom, broadcastPresence } from '~~/server/utils/realtime'

// Живая синхронизация совместной тренировки.
// Клиент после открытия шлёт {type:'auth', initData, workoutId}; после проверки
// членства мы заводим его в «комнату» и рассылаем presence. Дальше сервер шлёт
// {type:'sets-changed'} при правках подходов и {type:'presence'} при входе/выходе.
export default defineWebSocketHandler({
  async message(peer, message) {
    let msg: { type?: string; initData?: string; workoutId?: number }
    try { msg = JSON.parse(message.text()) } catch { return }
    if (msg.type !== 'auth') return

    try {
      const user = await authenticateInitData(msg.initData ?? '')
      const workoutId = Number(msg.workoutId)
      if (!Number.isInteger(workoutId) || !(await isWorkoutMember(db, workoutId, user.id))) {
        peer.send(JSON.stringify({ type: 'auth-error' }))
        return
      }
      joinRoom(peer, workoutId, user.id, user.name)
      peer.send(JSON.stringify({ type: 'auth-ok' }))
      broadcastPresence(workoutId)
    } catch {
      peer.send(JSON.stringify({ type: 'auth-error' }))
    }
  },

  close(peer) {
    const info = leaveRoom(peer.id)
    if (info) broadcastPresence(info.workoutId)
  },

  error(peer) {
    leaveRoom(peer.id)
  },
})
