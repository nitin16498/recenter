// Settings page: steps view, celebration style and duration (REC-30).
import { card, expect, expectCelebration, expectNoCelebration, openBoard, openCard, test } from './helpers.js'

const checked = (page, group) => page.locator(`[aria-label="${group}"] [aria-checked="true"]`)

test('defaults are Stepper, Popper + cheer and 2.0s', async ({ page }) => {
  await page.goto('/settings')
  await expect(checked(page, 'Steps view')).toHaveText('Stepper')
  await expect(checked(page, 'Celebration style')).toHaveText('🎉Popper + cheer')
  await expect(page.locator('.duration-control output')).toHaveText('2.0s')
  const slider = page.locator('.duration-control input')
  await expect(slider).toHaveAttribute('min', '0.6')
  await expect(slider).toHaveAttribute('max', '5')
})

test('choices are remembered after a reload', async ({ page }) => {
  await page.goto('/settings')
  await page.click('[data-value="timeline"]')
  await page.click('[data-value="sparks"]')
  await page.locator('.duration-control input').fill('3.5')
  await expect(page.locator('.duration-control output')).toHaveText('3.5s')
  await page.reload()
  await expect(checked(page, 'Steps view')).toHaveText('Timeline')
  await expect(checked(page, 'Celebration style')).toHaveText('✨Sparks')
  await expect(page.locator('.duration-control output')).toHaveText('3.5s')
})

test('picking a style plays a preview; arrow keys move the choice', async ({ page }) => {
  await page.goto('/settings')
  await page.click('[data-value="confetti"]')
  await expectCelebration(page)
  await page.keyboard.press('ArrowRight')
  await expect(checked(page, 'Celebration style')).toHaveText('✨Sparks')
})

test('Off disables the duration and nothing plays on the board', async ({ page }) => {
  await page.goto('/settings')
  await page.click('[data-value="off"]')
  await expect(page.locator('.duration-control input')).toBeDisabled()
  await expect(page.getByRole('button', { name: '▶ Preview' })).toBeDisabled()

  await page.locator('.nav-item', { hasText: 'Board' }).click()
  await card(page, 'Download insurance').locator('.card-check').click()
  await expectNoCelebration(page)
  await expect(card(page, 'Download insurance').locator('.card-action')).toContainText('Download the coverage summary')
})

test('the steps view setting changes the open card', async ({ page }) => {
  await page.goto('/settings')
  await page.click('[data-value="timeline"]')
  await page.locator('.nav-item', { hasText: 'Board' }).click()
  await openCard(page, 'Download insurance')
  await expect(page.locator('.timeline')).toBeVisible()
  await expect(page.locator('.stepper')).toHaveCount(0)
})
