import { beforeEach, describe, expect, it, vi } from 'vitest'

// settings.js reads localStorage when it loads, so each test gets a fresh
// in-memory storage and a fresh copy of the module.
function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
    removeItem: (k) => delete data[k],
    data,
  }
}

async function loadSettings(stored) {
  vi.resetModules()
  const storage = memoryStorage(stored ? { 'recenter-settings': JSON.stringify(stored) } : {})
  vi.stubGlobal('localStorage', storage)
  return { ...(await import('./settings.js')), storage }
}

beforeEach(() => vi.unstubAllGlobals())

describe('settings', () => {
  it('defaults to Stepper, Popper + cheer, 2.0s', async () => {
    const { getSettings } = await loadSettings()
    expect(getSettings()).toEqual({ stepsView: 'stepper', fxStyle: 'popper', fxSeconds: 2 })
  })

  it('loads saved settings', async () => {
    const { getSettings } = await loadSettings({ stepsView: 'timeline', fxStyle: 'sparks', fxSeconds: 3.5 })
    expect(getSettings()).toEqual({ stepsView: 'timeline', fxStyle: 'sparks', fxSeconds: 3.5 })
  })

  it('replaces invalid saved values with defaults and clamps the duration', async () => {
    const { getSettings } = await loadSettings({ stepsView: 'grid', fxStyle: 'fireworks', fxSeconds: 99 })
    expect(getSettings()).toEqual({ stepsView: 'stepper', fxStyle: 'popper', fxSeconds: 5 })
  })

  it('clamps short durations to the minimum', async () => {
    const { updateSettings, getSettings } = await loadSettings()
    updateSettings({ fxSeconds: 0.1 })
    expect(getSettings().fxSeconds).toBe(0.6)
  })

  it('survives unreadable storage', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', { getItem: () => '{not json', setItem: () => {} })
    const { getSettings } = await import('./settings.js')
    expect(getSettings().stepsView).toBe('stepper')
  })

  it('saves updates and notifies subscribers', async () => {
    const { updateSettings, getSettings, storage } = await loadSettings()
    updateSettings({ stepsView: 'timeline' })
    expect(getSettings().stepsView).toBe('timeline')
    expect(JSON.parse(storage.data['recenter-settings']).stepsView).toBe('timeline')
  })

  it('keeps working when storage writes throw (private mode)', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const { updateSettings, getSettings } = await import('./settings.js')
    expect(() => updateSettings({ fxStyle: 'off' })).not.toThrow()
    expect(getSettings().fxStyle).toBe('off')
  })
})
