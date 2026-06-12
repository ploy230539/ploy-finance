import { useState, useMemo, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFinance } from '../contexts/FinanceContext'
import { useLang } from '../contexts/LanguageContext'
import Modal from '../components/Modal'
import CategoryPicker from '../components/CategoryPicker'
import PhotoCapture from '../components/PhotoCapture'
import ReceiptViewer from '../components/ReceiptViewer'
import RecurringModal from '../components/RecurringModal'
import { CheckIcon } from '../components/Icons'

function formatMoney(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const emptyForm = {
  type: 'expense',
  category: '',
  amount: '',
  note: '',
  date: new Date().toISOString().split('T')[0],
  splitWith: [],
  splitNewPerson: '',
  photo: null,
  walletId: '',
}

export default function Transactions() {
  const {
    transactions, addTransaction, updateTransaction, deleteTransaction, people, addPerson,
    expenseCats, incomeCats, getCategory, addCustomCategory, deleteCustomCategory, wallets,
  } = useFinance()
  const { t, fmtDate } = useLang()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [viewReceipt, setViewReceipt] = useState(null)
  const [showRecurring, setShowRecurring] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  function addCategoryOfType(cat) {
    return addCustomCategory({ ...cat, type: form.type })
  }

  function openAdd() {
    setEditingId(null)
    setForm({ ...emptyForm, walletId: wallets[0]?.id || '' })
    setShowModal(true)
  }

  function openEdit(tx) {
    setEditingId(tx.id)
    setForm({
      type: tx.type,
      category: tx.category,
      amount: String(tx.amount),
      note: tx.note || '',
      date: tx.date,
      splitWith: tx.splitWith || [],
      splitNewPerson: '',
      photo: tx.photo || null,
      walletId: tx.walletId || wallets[0]?.id || '',
    })
    setShowModal(true)
  }

  // Open add modal when navigated from the FAB
  useEffect(() => {
    if (location.state?.openAdd) {
      openAdd()
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions
    return transactions.filter((t) => t.type === filter)
  }, [transactions, filter])

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach((tx) => {
      if (!groups[tx.date]) groups[tx.date] = []
      groups[tx.date].push(tx)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  function handleSubmit(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.category || isNaN(amount) || amount <= 0) return

    const payload = {
      type: form.type,
      category: form.category,
      amount,
      note: form.note,
      date: form.date,
      splitWith: form.splitWith,
      photo: form.photo,
      walletId: form.walletId || wallets[0]?.id,
    }

    if (editingId) {
      updateTransaction(editingId, payload)
    } else {
      addTransaction(payload)
    }

    setForm(emptyForm)
    setEditingId(null)
    setShowModal(false)
  }

  function addSplitPerson() {
    const name = form.splitNewPerson.trim()
    if (!name) return
    addPerson(name)
    setForm((f) => ({
      ...f,
      splitWith: f.splitWith.includes(name) ? f.splitWith : [...f.splitWith, name],
      splitNewPerson: '',
    }))
  }

  function toggleSplitPerson(name) {
    setForm((f) => ({
      ...f,
      splitWith: f.splitWith.includes(name)
        ? f.splitWith.filter((n) => n !== name)
        : [...f.splitWith, name],
    }))
  }

  const splitCount = form.splitWith.length + 1
  const splitAmount = form.amount && splitCount > 1 ? parseFloat(form.amount) / splitCount : null

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">{t('รายการทั้งหมด')}</h1>
        <button
          onClick={() => setShowRecurring(true)}
          className="text-sm font-medium text-primary-700 bg-primary-50 px-3 py-2 rounded-xl"
        >
          {t('🔁 ประจำ')}
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {[
          { key: 'all', label: 'ทั้งหมด' },
          { key: 'income', label: 'รายรับ' },
          { key: 'expense', label: 'รายจ่าย' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all ${
              filter === f.key
                ? 'border-primary-600 bg-primary-light text-primary-800'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {/* List */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] py-12 text-center">
          <div className="text-5xl mb-3">🪙</div>
          <p className="text-sm text-slate-400">{t('ยังไม่มีรายการ')}</p>
        </div>
      ) : (
        grouped.map(([date, txs]) => (
          <div key={date} className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-5 py-2.5 bg-primary-50 text-xs font-medium text-primary-800">
              {fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="px-5">
              {txs.map((tx) => {
                if (tx.type === 'transfer') {
                  const from = wallets.find((w) => w.id === tx.fromWalletId)
                  const to = wallets.find((w) => w.id === tx.toWalletId)
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 group">
                      <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-slate-100">🔄</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{tx.note || t('โอนเงิน')}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {from?.icon} {from ? t(from.name) : '—'} → {to?.icon} {to ? t(to.name) : '—'}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-500">฿{formatMoney(tx.amount)}</span>
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        className="text-slate-300 hover:text-expense transition-colors text-lg sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  )
                }
                const cat = getCategory(tx.category)
                const isIncome = tx.type === 'income'
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 group">
                    <button
                      onClick={() => openEdit(tx)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      title="แตะเพื่อแก้ไข"
                    >
                      <span
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: (cat?.color || '#999') + '20' }}
                      >
                        {cat?.icon || '📝'}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{tx.note || (cat ? t(cat.name) : '')}</span>
                        <span className="block text-xs text-slate-400 truncate">
                          {cat ? t(cat.name) : ''}
                          {tx.splitWith?.length > 0 && (
                            <span className="text-split">
                              {' · '}{t('หาร')} {tx.splitWith.length + 1} {t('คน')} · {t('คนละ')} ฿{formatMoney(tx.amount / (tx.splitWith.length + 1))}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    {tx.photo && (
                      <button
                        onClick={() => setViewReceipt(tx.photo)}
                        className="flex-shrink-0"
                        title="ดูสลิป"
                      >
                        <img src={tx.photo} alt="สลิป" className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                      </button>
                    )}
                    <span className={`text-sm font-bold ${isIncome ? 'text-income' : 'text-expense'}`}>
                      {isIncome ? '+' : '-'}฿{formatMoney(tx.amount)}
                    </span>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="text-slate-300 hover:text-expense transition-colors text-lg sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? t('แก้ไขรายการ') : t('เพิ่มรายการ')}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type toggle */}
          <div className="flex rounded-xl overflow-hidden border-2 border-slate-200">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'expense', category: '' })}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                form.type === 'expense' ? 'bg-expense text-white' : 'bg-white text-slate-500'
              }`}
            >
              {t('รายจ่าย')}
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'income', category: '', splitWith: [] })}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                form.type === 'income' ? 'bg-income text-white' : 'bg-white text-slate-500'
              }`}
            >
              {t('รายรับ')}
            </button>
          </div>

          {/* Amount */}
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              className="w-full pl-4 pr-12 py-4 border-2 border-slate-200 rounded-xl text-2xl font-bold text-right focus:outline-none focus:border-primary-600 transition-colors"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">฿</span>
          </div>

          {/* Category */}
          <Field label={t('หมวดหมู่')}>
            <CategoryPicker
              categories={form.type === 'expense' ? expenseCats : incomeCats}
              selected={form.category}
              onSelect={(id) => setForm({ ...form, category: id })}
              onAddCategory={addCategoryOfType}
              onDeleteCategory={deleteCustomCategory}
            />
          </Field>

          {/* Note */}
          <Field label={t('หมายเหตุ')}>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t('รายละเอียดเพิ่มเติม...')}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600 transition-colors"
            />
          </Field>

          {/* Date */}
          <Field label={t('วันที่')}>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600 transition-colors"
            />
          </Field>

          {/* Wallet */}
          {wallets.length > 1 && (
            <Field label={form.type === 'income' ? t('💰 เข้ากระเป๋า') : t('💰 จากกระเป๋า')}>
              <div className="flex flex-wrap gap-2">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setForm({ ...form, walletId: w.id })}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium border-2 transition-all flex items-center gap-1.5 ${
                      (form.walletId || wallets[0]?.id) === w.id ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <span>{w.icon}</span>{t(w.name)}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* Receipt photo */}
          <Field label={t('🧾 สลิป/ใบเสร็จ (ไม่บังคับ)')}>
            <PhotoCapture value={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
          </Field>

          {/* Split (hidden while editing to keep settlement data intact) */}
          {form.type === 'expense' && !editingId && (
            <Field label={t('👥 หารค่าใช้จ่าย')}>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={form.splitNewPerson}
                  onChange={(e) => setForm({ ...form, splitNewPerson: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSplitPerson())}
                  placeholder={t('พิมพ์ชื่อคนที่จะหาร...')}
                  className="flex-1 px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-split transition-colors"
                />
                <button type="button" onClick={addSplitPerson} className="px-4 py-2.5 bg-split text-white rounded-xl text-sm font-semibold">
                  {t('เพิ่ม')}
                </button>
              </div>

              {people.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {people.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleSplitPerson(p.name)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        form.splitWith.includes(p.name) ? 'bg-split text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {splitAmount && (
                <div className="bg-split-light rounded-xl p-3 text-sm text-split font-medium">
                  {t('หาร')} {splitCount} {t('คน')} → {t('คนละ')} <span className="font-bold">฿{formatMoney(splitAmount)}</span>
                </div>
              )}
            </Field>
          )}

          <button
            type="submit"
            disabled={!form.category || !form.amount}
            className="w-full py-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 bg-gradient-to-br from-primary-600 to-primary-700 shadow-[0_4px_12px_rgba(124,138,90,0.3)] active:translate-y-px"
          >
            <CheckIcon width={20} height={20} />
            {editingId ? t('บันทึกการแก้ไข') : t('บันทึกรายการ')}
          </button>
        </form>
      </Modal>

      <ReceiptViewer src={viewReceipt} onClose={() => setViewReceipt(null)} />
      <RecurringModal isOpen={showRecurring} onClose={() => setShowRecurring(false)} />
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      {children}
    </div>
  )
}
