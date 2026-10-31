// The expanded task card (REC-27), incl. the empty-steps crash regression (REC-30).
import {
  API,
  card,
  closeCard,
  column,
  expect,
  expectCelebration,
  expectNoCelebration,
  openBoard,
  openCard,
  taskNamed,
  test,
  useSettings,
} from './helpers.js'

test('opens over a blurred board and closes with Esc, × and a click outside', async ({ page }) => {
  await openBoard(page)
  await openCard(page, 'Download insurance')
  const modal = page.locator('.task-modal')
  await expect(modal.locator('.task-modal-crumb')).toHaveText('Get a medical checkup · Life')
  await expect(modal.locator('.task-modal-title')).toHaveValue('Download insurance docs from employer portal')
  await expect(modal.locator('.status-pick-item.active')).toHaveText('In progress')
  await expect(page.locator('.modal-scrim')).toBeVisible()
  await expect(card(page, 'Download insurance')).toHaveClass(/expanded/) // hidden while it's open
  await closeCard(page)
  await expect(card(page, 'Download insurance')).not.toHaveClass(/expanded/)

  await openCard(page, 'Download insurance')
  await page.click('.task-modal-close')
  await expect(modal).toHaveCount(0)

  await openCard(page, 'Download insurance')
  await page.mouse.click(30, 780) // the blurred backdrop
  await expect(modal).toHaveCount(0)
})

test('title, estimate and note save on blur; a blank title reverts', async ({ page, request }) => {
  await openBoard(page)
  await openCard(page, 'Pick a product')
  await page.fill('.task-modal-title', 'Pick a car cover and order it')
  await page.fill('.estimate-field input', '35')
  await page.fill('.task-modal textarea', 'Budget under $60')
  await page.locator('.task-modal-title').click() // blur the note
  await expect(page.locator('.task-modal-footer')).toHaveText('Saved')
  const t = await taskNamed(request, 'Pick a car cover')
  expect([t.est_minutes, t.note]).toEqual([35, 'Budget under $60'])

  await page.fill('.task-modal-title', '   ')
  await page.locator('.task-modal textarea').click()
  await expect(page.locator('.task-modal-title')).toHaveValue('Pick a car cover and order it')
})

test('edits in progress are saved when the card closes', async ({ page, request }) => {
  await openBoard(page)
  await openCard(page, 'Pick a product')
  await page.fill('.task-modal textarea', 'typed then Esc')
  await closeCard(page)
  await expect.poll(async () => (await taskNamed(request, 'Pick a product')).note).toBe('typed then Esc')
})

test('status buttons move the card; forward moves celebrate', async ({ page }) => {
  await openBoard(page)
  await openCard(page, 'Pick a product')
  await page.locator('.status-pick-item', { hasText: 'In progress' }).click()
  await expectCelebration(page)
  await expect(page.locator('.status-pick-item.active')).toHaveText('In progress')
  await page.waitForTimeout(2500) // let it finish
  await page.locator('.status-pick-item', { hasText: 'To do' }).click()
  await expectNoCelebration(page)
  await closeCard(page)
  await expect(column(page, 0)).toContainText('Pick a product and order it')
})

for (const view of ['stepper', 'timeline']) {
  test(`regression: a task with no steps opens in ${view} view`, async ({ page, request }) => {
    const t = await taskNamed(request, 'Pick a product')
    await request.put(`${API}/api/tasks/${t.id}/steps`, { data: { steps: [] } })
    await useSettings(page, { stepsView: view })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))

    await openBoard(page)
    await openCard(page, 'Pick a product')
    await expect(page.locator('.steps-empty')).toHaveText('No steps yet. Use Edit steps to add some.')
    await expect(page.locator('.task-card')).toHaveCount(7) // the board is still there
    expect(errors).toEqual([])

    // ...and steps can be added from there
    await page.click('.edit-steps-button')
    await page.fill('.bubble-add input', 'Open the two links')
    await page.keyboard.press('Enter')
    await page.click('.step-editor-foot .primary-button')
    await expect(page.locator('.steps-empty')).toHaveCount(0)
    await expect(page.getByText('First action · Step 1 of 1')).toBeVisible()
  })
}
