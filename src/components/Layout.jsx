import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { HomeIcon, ListIcon, CardIcon, SplitIcon } from './Icons'
import SettingsModal from './SettingsModal'
import { useLang } from '../contexts/LanguageContext'

const navItems = [
  { to: '/', label: 'หน้าหลัก', Icon: HomeIcon },
  { to: '/transactions', label: 'รายการ', Icon: ListIcon },
  { to: '/installments', label: 'ผ่อนชำระ', Icon: CardIcon },
  { to: '/split', label: 'หารบิล', Icon: SplitIcon },
]

export default function Layout() {
  const navigate = useNavigate()
  const { t, lang, toggle } = useLang()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="min-h-screen flex flex-col pb-[86px]">
      {/* Gradient Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-[0_2px_12px_rgba(217,119,6,0.3)]">
        <div className="max-w-xl mx-auto px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-base">
            <span className="text-xl">💰</span>
            <span className="font-display">เงินทองของฉันหายไปไหน</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="h-8 px-2.5 rounded-full flex items-center justify-center text-xs font-bold hover:bg-white/15 transition-colors border border-white/40"
              aria-label="Toggle language"
            >
              {lang === 'th' ? 'EN' : 'ไทย'}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl hover:bg-white/15 transition-colors"
              aria-label={t('ตั้งค่า')}
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Page Content */}
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom Nav with floating + button */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_16px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto flex items-stretch h-[70px]">
          {navItems.slice(0, 2).map((item) => (
            <NavItem key={item.to} {...item} />
          ))}

          {/* Floating Add Button */}
          <button
            onClick={() => navigate('/transactions', { state: { openAdd: true } })}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500"
          >
            <span className="relative -top-5 w-14 h-14 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 border-4 border-white text-white text-3xl flex items-center justify-center shadow-[0_4px_12px_rgba(217,119,6,0.4)] transition-transform active:scale-95 hover:scale-105 leading-none pb-1">
              +
            </span>
            <span className="relative -top-4">{t('เพิ่ม')}</span>
          </button>

          {navItems.slice(2).map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function NavItem({ to, label, Icon }) {
  const { t } = useLang()
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
          isActive ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
        }`
      }
    >
      <Icon width={24} height={24} />
      {t(label)}
    </NavLink>
  )
}
