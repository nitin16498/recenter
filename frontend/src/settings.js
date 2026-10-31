import { useSyncExternalStore } from 'react'

// User preferences from the Settings page (REC-30). Kept in localStorage like
// the theme: per browser, not synced. Any component can read them with
// useSettings(); non-React code (the celebration engine) uses getSettings().
const KEY = 'recenter-settings'

export const DEFAULTS = {
  stepsView: 'stepper', // 'stepper' | 'timeline'
  fxStyle: 'popper', // 'confetti' | 'sparks' | 'popper' | 'off'
  fxSeconds: 2.0, // 0.6–5
}
export const FX_SECONDS = { min: 0.6, max: 5, step: 0.1 }

function clean(raw) {
  const s = { ...DEFAULTS, ...raw }
  if (!['stepper', 'timeline'].includes(s.stepsView)) s.stepsView = DEFAULTS.stepsView
  if (!['confetti', 'sparks', 'popper', 'off'].includes(s.fxStyle)) s.fxStyle = DEFAULTS.fxStyle
  const secs = Number(s.fxSeconds)
  s.fxSeconds = Number.isFinite(secs)
    ? Math.min(FX_SECONDS.max, Math.max(FX_SECONDS.min, secs))
    : DEFAULTS.fxSeconds
  return s
}

function load() {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) || '{}'))
  } catch {
    return { ...DEFAULTS }
  }
}

let current = load()
const listeners = new Set()

export function getSettings() {
  return current
}

export function updateSettings(changes) {
  current = clean({ ...current, ...changes })
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Private mode / blocked storage: settings still apply for this visit.
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings)
}
