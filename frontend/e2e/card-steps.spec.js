// Collapsed cards: current step, First/Next/Last labels, ring check, undo (REC-30).
import {
  card,
  column,
  currentStep,
  expect,
  expectCelebration,
  openBoard,
  taskNamed,
  test,
} from './helpers.js'

test('in-progress cards label the current step by its position', async ({ page }) => {
  await openBoard(page)
  await expect(card(page, 'Download insurance').locator('.card-action')).toHaveText(
    '✓Next action: Download the insurance card PDF',
  )
  await expect(card(page, 'Book the hospital').locator('.card-action')).toHaveText(
    '✓Last action: Call the clinic and book one',
  )
  // To do cards don't show the step text
  await expect(card(page, 'Pick a product').locator('.card-action')).toHaveCount(0)
})

test('progress bars show once a step is done', async ({ page }) => {
  await openBoard(page)
  await expect(card(page, 'Download insurance').locator('.card-progress small')).toHaveText('2/5')
  await expect(card(page, 'Find what your insurance').locator('.card-progress small')).toHaveText('1/3')
  await expect(card(page, 'Pick a product').locator('.card-progress')).toHaveCount(0)
  await expect(card(page, 'Sketch the board').locator('.card-progress')).toHaveCount(0) // done
})

test('ticking the ring completes the step, celebrates, and can be undone', async ({ page, request }) => {
  await openBoard(page)
  const dl = card(page, 'Download insurance')
  await dl.locator('.card-check').click()
  await expectCelebration(page)
  await expect(page.locator('.task-modal')).toHaveCount(0) // ring doesn't open the card
  await expect(dl.locator('.card-action')).toContainText('Next action: Download the coverage summary')
  await expect(page.locator('.undo-toast')).toContainText('Done: Download the insurance card PDF')
  expect(currentStep(await taskNamed(request, 'Download insurance')).text).toBe('Download the coverage summary')

  await page.locator('.undo-toast button').click()
  await expect(dl.locator('.card-action')).toContainText('Next action: Download the insurance card PDF')
  expect(currentStep(await taskNamed(request, 'Download insurance')).text).toBe('Download the insurance card PDF')
})

test('finishing the last step offers Move to Done', async ({ page, request }) => {
  await openBoard(page)
  const book = card(page, 'Book the hospital')
  await book.locator('.card-check').click()
  await expect(book.locator('.card-action')).toContainText('All steps done')
  await book.getByRole('button', { name: 'Move to Done' }).click()
  await expectCelebration(page)
  await expect(column(page, 2)).toContainText('Book the hospital appointment')
  await expect.poll(async () => (await taskNamed(request, 'Book the hospital')).status).toBe('done')
})
