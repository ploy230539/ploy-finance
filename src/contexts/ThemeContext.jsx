import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const THEMES = [
  { id: 'amber', name: 'ส้มอำพัน', nameEn: 'Amber', color: '#D97706' },
  { id: 'muji', name: 'เขียวมูจิ', nameEn: 'Sage', color: '#7C8A5A' },
  { id: 'ocean', name: 'ฟ้าหม่น', nameEn: 'Ocean', color: '#3B7BB0' },
  { id: 'rose', name: 'ชมพูหวาน', nameEn: 'Rose', color: '#C45C7C' },
  { id: 'dark', name: 'โหมดมืด', nameEn: 'Dark', color: '#2B2A26' },
]

const ThemeContext = createContext()

function apply(theme) {
  const root = document.documentElement
  if (theme === 'amber') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  const c = THEMES.find((t) => t.id === theme)?.color || '#D97706'
  if (meta) meta.setAttribute('content', c)
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('ploy_theme') || 'amber')

  useEffect(() => {
    localStorage.setItem('ploy_theme', theme)
    apply(theme)
  }, [theme])

  const setTheme = useCallback((id) => {
    if (THEMES.some((t) => t.id === id)) setThemeState(id)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
