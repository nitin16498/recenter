// Board: columns, filters, drag (REC-27) + forward-move celebrations (REC-30).
import {
  card,
  column,
  expect,
  expectCelebration,
  expectNoCelebration,
  openBoard,
  taskNamed,
  test,
} from './helpers.js'

test('shows seeded tasks in three columns', async ({ page }) => {
  await openBoard(page)
  await expect(page.locator('.column-title')).toHaveText(['TO DO · 4', 'IN PROGRESS · 2', 'DONE · 1'])
  await expect(column(page, 2)).toContainText('Sketch the board layout')
})

test('epic and story chips filter the board', async ({ page }) => {
  await openBoard(page)
  await page.locator('.filter-row').first().getByRole('button', { name: 'Cooking' }).click()
  await expect(page.locator('.task-card')).toHaveCount(1)
  await expect(page.locator('.task-card')).toContainText("Pick this week's recipe")
  // Story chips narrow to the chosen epic
  const storyRow = page.locator('.filter-row').nth(1)
  await expect(storyRow.locator('.chip')).toHaveText(['All', 'Cook one new recipe a week'])

  await page.locator('.filter-row').first().getByRole('button', { name: 'Life' }).click()
  await storyRow.getByRole('button', { name: 'Get a medical checkup' }).click()
  await expect(page.locator('.task-card')).toHaveCount(3)
  // Picking another epic resets the story filter
  await page.locator('.filter-row').first().getByRole('button', { name: 'All' }).click()
  await expect(page.locator('.task-card')).toHaveCount(7)
})

test('By story view is disabled for now and habits toggle switches', async ({ page }) => {
  await openBoard(page)
  await expect(page.locator('.segmented-item.disabled')).toHaveText('By story')
  const toggle = page.locator('.habit-toggle input')
  await expect(toggle).toBeChecked()
  await page.locator('.habit-toggle').click()
  await expect(toggle).not.toBeChecked()
})

test('dragging a card forward saves the status and celebrates', async ({ page, request }) => {
  await openBoard(page)
  await page.dragAndDrop('.task-card:has-text("Pick a product")', '.board-column >> nth=1')
  await expectCelebration(page)
  await expect(column(page, 1)).toContainText('Pick a product and order it')
  await expect(card(page, 'Pick a product').locator('.card-action')).toContainText('First action: Open the two links from research')
  await expect.poll(async () => (await taskNamed(request, 'Pick a product')).status).toBe('in_progress')
})

test('dragging a card backwards saves quietly', async ({ page, request }) => {
  await openBoard(page)
  await page.dragAndDrop('.task-card:has-text("Sketch the board")', '.board-column >> nth=0')
  await expectNoCelebration(page)
  await expect.poll(async () => (await taskNamed(request, 'Sketch the board')).status).toBe('todo')
})
