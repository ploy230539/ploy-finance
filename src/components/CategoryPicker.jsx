import { useState } from 'react'
import { useLang } from '../contexts/LanguageContext'

// Curated emoji set + free typing lets users "make their own" icon
const EMOJI_CHOICES = [
  '🍜','🍔','🍕','🍣','🥗','🍰','🍿','☕','🧋','🍺','🛒','🛍️','📦','👕','👟','💄','💊','🏥','🦷','🐶',
  '🐱','🌱','🏠','🚗','🏍️','⛽','🚌','✈️','🏨','🎬','🎮','🎵','📚','✏️','💻','📱','🔌','💡','💧','🔥',
  '💼','🧾','💳','🏦','🎁','❤️','🙏','⚽','🏋️','🎨','🛠️','🧹','👶','🎓','💈','🚿','🧺','📷','🌹','⭐',
]

const COLOR_CHOICES = [
  '#D97706','#DC2626','#EA580C','#F59E0B','#16A34A','#059669','#0891B2','#0EA5E9',
  '#2563EB','#6366F1','#7C3AED','#DB2777','#EC4899','#F43F5E','#64748B','#475569',
]

export default function CategoryPicker({ categories, selected, onSelect, onAddCategory, onDeleteCategory }) {
  const { t } = useLang()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: '', icon: '🍜', color: '#D97706' })

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  function saveNew() {
    const name = draft.name.trim()
    const icon = (draft.icon || '').trim()
    if (!name || !icon) return
    const cat = onAddCategory({ name, icon, color: draft.color })
    if (cat?.id) onSelect(cat.id)
    setDraft({ name: '', icon: '🍜', color: '#D97706' })
    setCreating(false)
  }

  if (creating) {
    return (
      <div className="border-2 border-primary-200 bg-primary-50 rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-primary-800">{t('สร้างหมวดหมู่ใหม่')}</span>
          <button type="button" onClick={() => setCreating(false)} className="text-slate-400 text-xl leading-none">×</button>
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-3">
          <span
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: draft.color + '22' }}
          >
            {draft.icon || '❓'}
          </span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t('ชื่อหมวดหมู่ เช่น ค่าเลี้ยงลูก')}
            className="flex-1 px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600 bg-white"
            autoFocus
          />
        </div>

        {/* Icon: type any emoji + quick choices */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-xs text-slate-500">{t('ไอคอน (พิมพ์ emoji เองได้)')}</label>
            <input
              type="text"
              value={draft.icon}
              onChange={(e) => setDraft({ ...draft, icon: [...e.target.value][0] || '' })}
              className="w-14 px-2 py-1 border-2 border-slate-200 rounded-lg text-center text-lg bg-white focus:outline-none focus:border-primary-600"
            />
          </div>
          <div className="grid grid-cols-10 gap-1 max-h-24 overflow-y-auto no-scrollbar">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setDraft({ ...draft, icon: e })}
                className={`aspect-square rounded-lg text-lg flex items-center justify-center ${
                  draft.icon === e ? 'bg-primary-200' : 'bg-white hover:bg-slate-100'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="text-xs text-slate-500 block mb-1.5">{t('สี')}</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft({ ...draft, color: c })}
                className={`w-7 h-7 rounded-full transition-transform ${draft.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={saveNew}
          disabled={!draft.name.trim() || !draft.icon.trim()}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold bg-gradient-to-br from-primary-600 to-primary-700 disabled:opacity-40"
        >
          {t('เพิ่มหมวดหมู่')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        placeholder={t('ค้นหาหมวดหมู่...')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm mb-3 focus:outline-none focus:border-primary-600 transition-colors"
      />
      <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto no-scrollbar">
        {filtered.map((cat) => {
          const active = selected === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-2xl text-xs transition-all border-2 ${
                active ? 'border-primary-600 bg-primary-50 font-semibold' : 'border-transparent bg-slate-50 hover:bg-slate-100'
              }`}
            >
              {cat.custom && onDeleteCategory && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id) }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-300 hover:bg-expense text-white text-xs flex items-center justify-center"
                >
                  ×
                </span>
              )}
              <span
                className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: active ? cat.color + '22' : '#ffffff' }}
              >
                {cat.icon}
              </span>
              <span className="truncate w-full text-center leading-tight text-[11px]">{t(cat.name)}</span>
            </button>
          )
        })}

        {/* Add new category tile */}
        {onAddCategory && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl text-xs border-2 border-dashed border-primary-300 text-primary-700 hover:bg-primary-50 transition-colors"
          >
            <span className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl bg-primary-50">＋</span>
            <span className="text-[11px]">{t('เพิ่มเอง')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
