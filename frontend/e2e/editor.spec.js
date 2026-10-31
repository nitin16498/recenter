// Edit steps: add, rename, delete, hold-and-drag reorder, keyboard, Save/Cancel — REC-30.
import { card, closeCard, expect, openBoard, openCard, taskNamed, test } from './helpers.js'

const openBubbles = (page) => page.locator('.bubble:not(.locked)')
const openTexts = (page) => openBubbles(page).locator('.bubble-text')

async function openEditor(page, title) {
  await openBoard(page)
  await openCard(page, title)
  await page.click('.edit-steps-button')
  await expect(page.locator('.step-editor')).toBeVisible()
}

test('finished steps are locked and the first open step is marked current', async ({ page }) => {
  await openEditor(page, 'Download insurance')
  const locked = page.locator('.bubble.locked')
  await expect(locked).toHaveCount(2)
  await expect(locked.locator('.bubble-delete')).toHaveCount(0)
  await expect(locked.locator('.bubble-grip')).toHaveCount(0)
  await expect(openBubbles(page).first().locator('.bubble-tag')).toHaveText('current')
})

test('adds steps with Enter or the ✓ button, keeping focus in the box', async ({ page }) => {
  await openEditor(page, 'Book the hospital')
  const input = page.locator('.bubble-add input')
  await expect(page.locator('.bubble-add-confirm')).toHaveCount(0)
  await input.fill('   ')
  await expect(page.locator('.bubble-add-confirm')).toHaveCount(0)
  await input.fill('Add it to the calendar')
  await page.click('.bubble-add-confirm')
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await page.keyboard.type('Set a reminder')
  await page.keyboard.press('Enter')
  await expect(openTexts(page)).toHaveText(['Call the clinic and book one', 'Add it to the calendar', 'Set a reminder'])
})

test('click to rename; Esc reverts only the rename', async ({ page }) => {
  await openEditor(page, 'Book the hospital')
  await openTexts(page).first().click()
  const field = page.locator('.bubble-input')
  await field.fill('Call the clinic by phone')
  await page.keyboard.press('Enter')
  await expect(openTexts(page).first()).toHaveText('Call the clinic by phone')

  await openTexts(page).first().click()
  await field.fill('something else')
  await page.keyboard.press('Escape')
  await expect(page.locator('.step-editor')).toBeVisible()
  await expect(openTexts(page).first()).toHaveText('Call the clinic by phone')
})

test('deletes a step', async ({ page }) => {
  await openEditor(page, 'Download insurance')
  await openBubbles(page).nth(1).hover()
  await openBubbles(page).nth(1).locator('.bubble-delete').click()
  await expect(openTexts(page)).toHaveText(['Download the insurance card PDF', 'Save both to a "Medical" folder'])
})

test('hold and drag reorders steps', async ({ page }) => {
  await openEditor(page, 'Download insurance')
  const from = await openBubbles(page).nth(2).boundingBox()
  const to = await openBubbles(page).nth(0).boundingBox()
  await page.mouse.move(from.x + 140, from.y + from.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(260) // hold
  await page.mouse.move(to.x + 140, to.y + 4, { steps: 10 })
  await page.mouse.up()
  await expect(openTexts(page)).toHaveText([
    'Save both to a "Medical" folder',
    'Download the insurance card PDF',
    'Download the coverage summary',
  ])
})

test('Alt+arrow keys move the focused step', async ({ page }) => {
  await openEditor(page, 'Download insurance')
  await openBubbles(page).nth(2).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(openTexts(page)).toHaveText([
    'Download the insurance card PDF',
    'Save both to a "Medical" folder',
    'Download the coverage summary',
  ])
  await expect(openBubbles(page).nth(1)).toBeFocused()
})

test('Esc cancels the editor without saving; a second Esc closes the card', async ({ page, request }) => {
  await openEditor(page, 'Download insurance')
  await openBubbles(page).first().hover()
  await openBubbles(page).first().locator('.bubble-delete').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.step-editor')).toHaveCount(0)
  await expect(page.locator('.task-modal')).toBeVisible()
  expect((await taskNamed(request, 'Download insurance')).steps).toHaveLength(5)
  await closeCard(page)
})

test('Save persists the new order and the board label follows', async ({ page, request }) => {
  await openEditor(page, 'Download insurance')
  await openBubbles(page).nth(2).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await page.keyboard.press('Alt+ArrowUp')
  await page.fill('.bubble-add input', 'Email HR if anything is missing')
  await page.keyboard.press('Enter')
  await page.click('.step-editor-foot .primary-button')
  await expect(page.locator('.step-editor')).toHaveCount(0)

  const t = await taskNamed(request, 'Download insurance')
  expect(t.steps.map((s) => s.text)).toEqual([
    'Log in to the HR portal',
    'Open Benefits → Documents',
    'Save both to a "Medical" folder',
    'Download the insurance card PDF',
    'Download the coverage summary',
    'Email HR if anything is missing',
  ])
  await closeCard(page)
  await expect(card(page, 'Download insurance').locator('.card-action')).toContainText(
    'Next action: Save both to a "Medical" folder',
  )
})
