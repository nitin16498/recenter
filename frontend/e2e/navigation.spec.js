// App shell + Coach chat (REC-6/8/9). The backend's test mode returns canned replies.
import { expect, test } from './helpers.js'

test('sidebar shows every section and each route renders', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('.sidebar .nav-item')
  await expect(nav).toHaveText(['💬Coach', '☀️Today', '🗂️Board', '🎯Identity', '📈Progress', '⚙️Settings'])

  for (const [link, heading] of [
    ['Today', 'Today'],
    ['Identity', 'Identity'],
    ['Progress', 'Progress'],
  ]) {
    await page.locator('.nav-item', { hasText: link }).click()
    await expect(page.locator('h1')).toHaveText(heading)
  }
  await page.locator('.nav-item', { hasText: 'Board' }).click()
  await expect(page.locator('.board-title')).toHaveText('Board')
  await page.locator('.nav-item', { hasText: 'Settings' }).click()
  await expect(page.locator('.page-title')).toHaveText('Settings')
})

test('coach chat sends a message, shows the reply, and keeps history', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.message.assistant').first()).toContainText('Welcome to Recenter')
  await page.fill('.composer-input', 'help me plan today')
  await page.click('.composer-send')
  await expect(page.locator('.message.user').last()).toHaveText('help me plan today')
  await expect(page.locator('.message.assistant').last()).toHaveText('(test reply) help me plan today')

  await page.reload()
  await expect(page.locator('.message')).toHaveCount(3)
})

test('send button is disabled for an empty message', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.composer-send')).toBeDisabled()
  await page.fill('.composer-input', '   ')
  await expect(page.locator('.composer-send')).toBeDisabled()
})
