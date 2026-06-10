import { useState } from 'react'
import { useFinance } from '../contexts/FinanceContext'
import Modal from './Modal'
import CategoryPicker from './CategoryPicker'

function formatMoney(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const emptyForm = { type: 'expense', category: '', amount: '', note: '', dayOfMonth: '1' }

export default function RecurringModal({ isOpen, onClose }) {
  const {
    recurring, addRecurring, toggleRecurring, deleteRecurring,
    getCategory, expenseCats, incomeCats, addCustomCategory, deleteCustomCategory,
  } = useFinance()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyForm)

  function save() {
    const amount = parseFloat(form.amount)
    const day = parseInt(form.dayOfMonth)
    if (!form.category || isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > 28) return
    addRecurring({ type: form.type, category: form.category, amount, note: form.note, dayOfMonth: day })
    setForm(emptyForm)
    setAdding(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="รายการประจำอัตโนมัติ">
      {!adding ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            ตั้งรายการที่เกิดทุกเดือน (เงินเดือน/ค่าเช่า/ค่าสมาชิก) ระบบจะบันทึกให้อัตโนมัติเมื่อถึงวันที่กำหนด
          </p>

          {recurring.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-2">🔁</div>
              <p className="text-sm text-slate-400">ยังไม่มีรายการประจำ</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recurring.map((r) => {
                const cat = getCategory(r.category)
                const isIncome = r.type === 'income'
                return (
                  <div key={r.id} className={`flex items-center gap-3 rounded-xl p-3 ${r.active ? 'bg-slate-50' : 'bg-slate-50 opacity-50'}`}>
                    <span className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: (cat?.color || '#999') + '22' }}>
                      {cat?.icon || '📝'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.note || cat?.name}</div>
                      <div className="text-xs text-slate-400">ทุกวันที่ {r.dayOfMonth} ของเดือน</div>
                    </div>
                    <span className={`text-sm font-bold ${isIncome ? 'text-income' : 'text-expense'}`}>
                      {isIncome ? '+' : '-'}฿{formatMoney(r.amount)}
                    </span>
                    <button
                      onClick={() => toggleRecurring(r.id)}
                      className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${r.active ? 'bg-income' : 'bg-slate-300'}`}
                      title={r.active ? 'เปิดอยู่' : 'ปิดอยู่'}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${r.active ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                    <button onClick={() => deleteRecurring(r.id)} className="text-slate-300 hover:text-expense text-lg flex-shrink-0">×</button>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={() => { setForm(emptyForm); setAdding(true) }}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold bg-gradient-to-br from-primary-600 to-primary-700 active:translate-y-px"
          >
            + เพิ่มรายการประจำ
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex rounded-xl overflow-hidden border-2 border-slate-200">
            <button type="button" onClick={() => setForm({ ...form, type: 'expense', category: '' })}
              className={`flex-1 py-3 text-sm font-semibold ${form.type === 'expense' ? 'bg-expense text-white' : 'bg-white text-slate-500'}`}>รายจ่าย</button>
            <button type="button" onClick={() => setForm({ ...form, type: 'income', category: '' })}
              className={`flex-1 py-3 text-sm font-semibold ${form.type === 'income' ? 'bg-income text-white' : 'bg-white text-slate-500'}`}>รายรับ</button>
          </div>

          <div className="relative">
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00" className="w-full pl-4 pr-12 py-4 border-2 border-slate-200 rounded-xl text-2xl font-bold text-right focus:outline-none focus:border-primary-600" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">฿</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">หมวดหมู่</label>
            <CategoryPicker
              categories={form.type === 'expense' ? expenseCats : incomeCats}
              selected={form.category}
              onSelect={(id) => setForm({ ...form, category: id })}
              onAddCategory={(c) => addCustomCategory({ ...c, type: form.type })}
              onDeleteCategory={deleteCustomCategory}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">หมายเหตุ</label>
            <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="เช่น ค่าเช่าบ้าน, Netflix..." className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">บันทึกทุกวันที่ (1–28)</label>
            <input type="number" min="1" max="28" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setAdding(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600">ยกเลิก</button>
            <button onClick={save} disabled={!form.category || !form.amount}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold bg-gradient-to-br from-primary-600 to-primary-700 disabled:opacity-40">บันทึก</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
