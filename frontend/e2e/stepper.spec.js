// Steps in the open card, Stepper view (the default) — REC-30.
import {
  closeCard,
  currentStep,
  expect,
  expectCelebration,
  openBoard,
  openCard,
  taskNamed,
  test,
} from './helpers.js'

const viewing = (page) => page.locator('.step-slide.viewing .step-text')

test('opens on the current step and moves with arrows, keys and dots', async ({ page }) => {
  await openBoard(page)
  await openCard(page, 'Download insurance')
  await expect(page.locator('.steps-head small')).toHaveText('2 of 5 done')
  await expect(viewing(page)).toHaveText('Download the insurance card PDF')
  await expect(page.locator('.step-slide.viewing .step-label')).toHaveText('Next action · Step 3 of 5')

  await page.click('.stepper-arrow.next')
  await expect(viewing(page)).toHaveText('Download the coverage summary')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(viewing(page)).toHaveText('Open Benefits → Documents')
  await expect(page.locator('.step-slide.viewing .step-label')).toContainText('Done')

  await page.click('.stepper-dots-row .link-button') // Back to current step
  await expect(viewing(page)).toHaveText('Download the insurance card PDF')
  await page.locator('.stepper-dot').first().click()
  await expect(viewing(page)).toHaveText('Log in to the HR portal')
  await expect(page.locator('.stepper-arrow.prev')).toBeDisabled()
})

test('dragging the strip with the mouse scrolls to another step', async ({ page }) => {
  await openBoard(page)
  await openCard(page, 'Download insurance')
  const box = await page.locator('.stepper-track').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + 70)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 420, box.y + 70, { steps: 12 })
  await page.mouse.up()
  await expect(viewing(page)).toHaveText('Download the coverage summary')
})

test('Mark done celebrates and glides to the next step', async ({ page, request }) => {
  await openBoard(page)
  await openCard(page, 'Download insurance')
  await page.click('.step-slide.current .primary-button')
  await expectCelebration(page)
  await expect(viewing(page)).toHaveText('Download the coverage summary')
  await expect(page.locator('.steps-head small')).toHaveText('3 of 5 done')
  expect(currentStep(await taskNamed(request, 'Download insurance')).text).toBe('Download the coverage summary')
})

test('Undo on a finished step reopens it', async ({ page, request }) => {
  await openBoard(page)
  await openCard(page, 'Download insurance')
  await page.keyboard.press('ArrowLeft')
  await page.locator('.step-slide.viewing').getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.steps-head small')).toHaveText('1 of 5 done')
  expect(currentStep(await taskNamed(request, 'Download insurance')).text).toBe('Open Benefits → Documents')
})

test('finishing a step on a To do task starts it, with an undo', async ({ page, request }) => {
  await openBoard(page)
  await openCard(page, 'Find what your insurance')
  await page.click('.step-slide.current .primary-button')
  await expect(page.locator('.status-pick-item.active')).toHaveText('In progress')
  await expect(page.locator('.undo-toast')).toContainText('Step done. Moved to In progress')
  await page.locator('.undo-toast button').click()
  await expect.poll(async () => (await taskNamed(request, 'Find what your insurance')).status).toBe('todo')
  expect(currentStep(await taskNamed(request, 'Find what your insurance')).text).toBe('Find the preventive-care section')
})

test('the last step asks to move the task to Done', async ({ page, request }) => {
  await openBoard(page)
  await openCard(page, 'Book the hospital')
  await page.click('.step-slide.current .primary-button')
  const prompt = page.locator('.all-done-prompt')
  await expect(prompt).toContainText('That was the last step')
  await prompt.getByRole('button', { name: 'Not yet' }).click()
  await expect(prompt).toHaveCount(0)

  await page.locator('.step-slide.viewing').getByRole('button', { name: 'Undo' }).click()
  await page.click('.step-slide.current .primary-button')
  await prompt.getByRole('button', { name: 'Move to Done' }).click()
  await expectCelebration(page)
  await expect(page.locator('.status-pick-item.active')).toHaveText('Done')
  await closeCard(page)
  await expect.poll(async () => (await taskNamed(request, 'Book the hospital')).status).toBe('done')
})
