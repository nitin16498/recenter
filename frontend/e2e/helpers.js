// Shared helpers for the browser tests.
import { expect, test as base } from '@playwright/test'

export const API = 'http://localhost:8011'

// Every test starts from freshly seeded data (see backend /api/_test/reset).
export const test = base.extend({
  page: async ({ page, request }, use) => {
    const res = await request.post(`${API}/api/_test/reset`)
    expect(res.ok(), 'backend must run with RECENTER_TESTING=1').toBeTruthy()
    await use(page)
  },
})
export { expect }

export async function allTasks(request) {
  const board = await (await request.get(`${API}/api/board`)).json()
  return Object.values(board.columns).flat()
}

export async function taskNamed(request, prefix) {
  return (await allTasks(request)).find((t) => t.title.startsWith(prefix))
}

export const currentStep = (task) => task.steps.find((s) => !s.done_at)

// Pre-set Settings before the app loads.
export async function useSettings(page, settings) {
  await page.addInitScript((s) => localStorage.setItem('recenter-settings', JSON.stringify(s)), settings)
}

export const card = (page, title) => page.locator('.task-card', { hasText: title })
export const column = (page, i) => page.locator('.board-column').nth(i)
export const fxCount = (page) => page.locator('.fx-layer > *').count()

export async function openBoard(page) {
  await page.goto('/board')
  await expect(page.locator('.task-card').first()).toBeVisible()
}

export async function openCard(page, title) {
  await card(page, title).click()
  await expect(page.locator('.task-modal')).toBeVisible()
  await page.waitForTimeout(350) // grow animation
}

export async function closeCard(page) {
  await page.keyboard.press('Escape')
  await expect(page.locator('.task-modal')).toHaveCount(0)
}

// A celebration put particles on screen (and they clean themselves up).
export async function expectCelebration(page) {
  await expect.poll(() => fxCount(page)).toBeGreaterThan(0)
}

export async function expectNoCelebration(page) {
  await page.waitForTimeout(250)
  expect(await fxCount(page)).toBe(0)
}
