import { retrieveRawInitData } from '@telegram-apps/sdk'

export default defineNuxtPlugin(() => {
  let initData = ''
  try {
    initData = retrieveRawInitData() ?? ''
  } catch {
    initData = '' // не внутри Telegram (обычный браузер / dev)
  }
  const state = useState<string>('tgInitData', () => '')
  state.value = initData
})
