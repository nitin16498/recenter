import { useEffect, useState } from 'react'

// Light/dark theme. index.html sets data-theme before first paint; this hook
// reads it, toggles it, and saves the choice. With no saved choice the app
// keeps following the OS setting.
const KEY = 'recenter-theme'

function savedTheme() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (savedTheme()) return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const follow = (e) => !savedTheme() && setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', follow)
    return () => mq.removeEventListener('change', follow)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Private mode / blocked storage: the toggle still works for this visit.
    }
  }

  return [theme, toggle]
}
