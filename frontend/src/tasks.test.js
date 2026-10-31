import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  STATUS_ORDER,
  actionLabel,
  currentStepIndex,
  doneStepCount,
  formatDoneAt,
  patchTask,
  replaceSteps,
} from './tasks.js'

const step = (text, done = false) => ({ id: text, text, done_at: done ? '2026-10-30T16:12:00' : null })
const task = (...steps) => ({ steps })

describe('current step', () => {
  it('is the first step not done', () => {
    expect(currentStepIndex(task(step('a', true), step('b'), step('c')))).toBe(1)
  })
  it('is -1 when every step is done or there are none', () => {
    expect(currentStepIndex(task(step('a', true)))).toBe(-1)
    expect(currentStepIndex(task())).toBe(-1)
  })
  it('counts done steps', () => {
    expect(doneStepCount(task(step('a', true), step('b'), step('c', true)))).toBe(2)
  })
})

describe('action label (First / Next / Last by position)', () => {
  it('says First action when nothing is done', () => {
    expect(actionLabel(task(step('a'), step('b'), step('c')))).toBe('First action')
  })
  it('says Next action in the middle', () => {
    expect(actionLabel(task(step('a', true), step('b'), step('c')))).toBe('Next action')
  })
  it('says Last action when only the final step is left', () => {
    expect(actionLabel(task(step('a', true), step('b', true), step('c')))).toBe('Last action')
  })
  it('prefers First for a single-step task', () => {
    expect(actionLabel(task(step('only')))).toBe('First action')
  })
  it('is null when all steps are done', () => {
    expect(actionLabel(task(step('a', true)))).toBeNull()
  })
})

describe('formatDoneAt', () => {
  it('reads naive API timestamps as UTC', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString().replace('Z', '')
    expect(formatDoneAt(fiveMinAgo)).not.toBe('just now')
    const now = new Date().toISOString().replace('Z', '')
    expect(formatDoneAt(now)).toBe('just now')
  })
})

it('orders statuses so only forward moves celebrate', () => {
  expect(STATUS_ORDER.todo < STATUS_ORDER.in_progress).toBe(true)
  expect(STATUS_ORDER.in_progress < STATUS_ORDER.done).toBe(true)
})

describe('API helpers', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('PATCHes only the given fields', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 3 }) })
    vi.stubGlobal('fetch', fetch)
    await patchTask(3, { note: 'x' })
    expect(fetch).toHaveBeenCalledWith('/api/tasks/3', expect.objectContaining({ method: 'PATCH', body: '{"note":"x"}' }))
  })

  it('PUTs the open steps for the editor Save', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetch)
    await replaceSteps(7, [{ id: 1, text: 'a' }, { text: 'b' }])
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/7/steps',
      expect.objectContaining({ method: 'PUT', body: '{"steps":[{"id":1,"text":"a"},{"text":"b"}]}' }),
    )
  })

  it('throws on HTTP errors so callers can roll back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }))
    await expect(patchTask(1, { title: '' })).rejects.toThrow('HTTP 422')
  })
})
