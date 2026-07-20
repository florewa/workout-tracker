import { expect, test } from '@playwright/test'

test('основные экраны работают на мобильном viewport без ошибок консоли', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/progress')
  await expect(page.getByRole('heading', { name: 'Прогресс' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Мой рост' })).toBeVisible()
  await page.getByRole('button', { name: 'С друзьями' }).click()
  await expect(page.getByText('Сравниваем рост, а не абсолютные веса')).toBeVisible()

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Скачать данные/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Удалить аккаунт/ })).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('health-check подтверждает доступность базы', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBe(true)
  await expect(response.json()).resolves.toMatchObject({ status: 'ok', database: 'ok' })
})
