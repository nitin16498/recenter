// Steps in the open card, Timeline view (Settings → Steps view) — REC-30.
import { currentStep, expect, openBoard, openCard, taskNamed, test, useSettings } from './helpers.js'

test.beforeEach(async ({ page }) => useSettings(page, { stepsView: 'timeline' }))

test('shows finished, current and upcoming steps in a list', async ({ page }) => {
  await openBoard(page)
  await openCard(page, 'Download insurance')
  await expect(page.locator('.stepper')).toHaveCount(0)
  await expect(page.locator('.timeline-step.done')).toHaveCount(2)
  await expect(page.locator('.timeline-step.current .step-label')).toHaveText('Next action · Step 3 of 5')
  await expect(page.locator('.timeline-step.upcoming')).toHaveCount(2)
})

test('Mark done advances and clicking a finished check undoes it', async ({ page, request }) => {
  await openBoard(page)
  await openCard(page, 'Download insurance')
  await page.click('.timeline-step.current .primary-button')
  await expect(page.locator('.timeline-step.current .timeline-text')).toHaveText('Download the coverage summary')
  await expect(page.locator('.timeline-step.done')).toHaveCount(3)

  await page.locator('.timeline-step.done .timeline-dot').last().click()
  await expect(page.locator('.timeline-step.current .timeline-text')).toHaveText('Download the insurance card PDF')
  expect(currentStep(await taskNamed(request, 'Download insurance')).text).toBe('Download the insurance card PDF')
})
