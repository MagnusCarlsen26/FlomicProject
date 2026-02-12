import { useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './themeContextValue'

const STORAGE_KEY = 'flomic-theme'
const THEMES = ['light', 'dark', 'system']

function getStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getResolvedTheme(theme) {
  return theme === 'system' ? getSystemTheme() : theme
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState(() => getResolvedTheme(getStoredTheme()))

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const updateResolvedTheme = () => {
      setResolvedTheme(getResolvedTheme(theme))
    }

    updateResolvedTheme()
    mediaQuery.addEventListener('change', updateResolvedTheme)

    return () => {
      mediaQuery.removeEventListener('change', updateResolvedTheme)
    }
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', resolvedTheme)
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Ignore storage errors in private browsing modes.
    }
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme: () => setTheme((current) => (getResolvedTheme(current) === 'dark' ? 'light' : 'dark')),
    }),
    [theme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
