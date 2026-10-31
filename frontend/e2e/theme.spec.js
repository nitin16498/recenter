// Dark mode (REC-27 review) and reduced motion.
import { card, expect, openBoard, test } from './helpers.js'

test('dark mode toggle applies and is remembered', async ({ page }) => {
  await page.goto('/board')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.locator('.theme-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('.theme-toggle input')).toBeChecked()
})

test.describe('with the OS in dark mode', () => {
  test.use({ colorScheme: 'dark' })
  test('follows the OS when nothing is saved', async ({ page }) => {
    await page.goto('/board')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })
  test('no celebrations play, but the step still completes', async ({ page }) => {
    await openBoard(page)
    await card(page, 'Download insurance').locator('.card-check').click()
    await expect(card(page, 'Download insurance').locator('.card-action')).toContainText('Download the coverage summary')
    expect(await page.locator('.fx-layer > *').count()).toBe(0)
  })
})
