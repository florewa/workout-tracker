import { retrieveRawInitData, retrieveLaunchParams } from '@telegram-apps/sdk'

export default defineNuxtPlugin(() => {
  let initData = ''
  let startParam = ''
  try {
    initData = retrieveRawInitData() ?? ''
  } catch {
    initData = '' // не внутри Telegram (обычный браузер / dev)
  }
  try {
    const lp = retrieveLaunchParams() as Record<string, unknown>
    startParam = (lp.tgWebAppStartParam as string) ?? (lp.startParam as string) ?? ''
  } catch {
    startParam = ''
  }
  useState<string>('tgInitData', () => '').value = initData
  useState<string>('tgStartParam', () => '').value = startParam
})
