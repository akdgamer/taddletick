import { useState } from 'react'

type Theme = 'auto' | 'light' | 'dark'

const NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }
const LABELS: Record<Theme, string> = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' }
const KEY = 'theme'

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

// "auto" removes data-theme so the CSS follows the system setting (index.html applies it before first paint)
function applyTheme(theme: Theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
  try {
    if (theme === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Private mode etc.: the choice just won't be remembered
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  const cycle = () => {
    const next = NEXT[theme]
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button className="theme-toggle" onClick={cycle} title="Switch between auto, light and dark">
      {LABELS[theme]}
    </button>
  )
}
