import { useState } from 'react'
import { useFinance } from '../contexts/FinanceContext'
import Modal from './Modal'

export default function BudgetModal({ isOpen, onClose }) {
  const { expenseCats, budgets, setBudget } = useFinance()
  const [search, setSearch] = useState('')

  const filtered = expenseCats.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  // budgeted categories first
  const sorted = [...filtered].sort((a, b) => (budgets[b.id] ? 1 : 0) - (budgets[a.id] ? 1 : 0))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ตั้งงบประมาณรายเดือน">
      <div className="space-y-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          กำหนดวงเงินต่อเดือนของแต่ละหมวด ระบบจะเตือนเมื่อใช้ใกล้/เกินงบ (เว้นว่าง = ไม่จำกัด)
        </p>
        <input
          type="text"
          placeholder="ค้นหาหมวดหมู่..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600"
        />
        <div className="space-y-2 max-h-[55vh] overflow-y-auto no-scrollbar">
          {sorted.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3">
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: (cat.color || '#999') + '22' }}
              >
                {cat.icon}
              </span>
              <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
              <div className="relative w-32 flex-shrink-0">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={budgets[cat.id] ?? ''}
                  onChange={(e) => setBudget(cat.id, parseFloat(e.target.value) || 0)}
                  placeholder="ไม่จำกัด"
                  className={`w-full pl-3 pr-7 py-2 border-2 rounded-xl text-sm text-right focus:outline-none transition-colors ${
                    budgets[cat.id] ? 'border-primary-400 bg-primary-50' : 'border-slate-200'
                  }`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">฿</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
