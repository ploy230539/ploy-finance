import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { translate } from '../i18n'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ploy_lang') || 'th')

  useEffect(() => {
    localStorage.setItem('ploy_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((thai) => translate(lang, thai), [lang])
  const toggle = useCallback(() => setLang((l) => (l === 'th' ? 'en' : 'th')), [])

  const locale = lang === 'en' ? 'en-GB' : 'th-TH'
  const fmtDate = useCallback((date, opts) => new Date(date).toLocaleDateString(locale, opts), [locale])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t, locale, fmtDate }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
