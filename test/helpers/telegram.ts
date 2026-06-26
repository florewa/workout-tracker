import { createHmac } from 'node:crypto'

// Подписывает initData по алгоритму Telegram Mini Apps (для тестов).
export function signInitData(params: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  const usp = new URLSearchParams(params)
  usp.append('hash', hash)
  return usp.toString()
}
