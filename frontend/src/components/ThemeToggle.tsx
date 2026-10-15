import { useState } from 'react'

type Theme = 'auto' | 'light' | 'dark'

const LABELS: Record<Theme, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' }
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

/** Auto / Light / Dark switch (lives in the user menu). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  return (
    <div className="segmented" role="group" aria-label="Appearance">
      {(Object.keys(LABELS) as Theme[]).map((t) => (
        <button
          key={t}
          aria-pressed={theme === t}
          onClick={() => {
            applyTheme(t)
            setTheme(t)
          }}
        >
          {LABELS[t]}
        </button>
      ))}
    </div>
  )
}
