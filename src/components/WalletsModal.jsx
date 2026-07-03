import { useState } from 'react'
import { useFinance } from '../contexts/FinanceContext'
import { useLang } from '../contexts/LanguageContext'
import { todayISO } from '../utils/date'
import Modal from './Modal'

function formatMoney(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const WALLET_ICONS = ['💵', '🏦', '💳', '📱', '🐷', '💰', '🪙', '💴', '🏧', '🧧']
const COLORS = ['#059669', '#2563EB', '#7C3AED', '#D97706', '#DC2626', '#EA580C', '#0891B2', '#DB2777', '#64748B', '#16A34A']

const emptyForm = { name: '', icon: '💵', color: '#059669', initialBalance: '' }

export default function WalletsModal({ isOpen, onClose }) {
  const { wallets, walletBalances, addWallet, updateWallet, deleteWallet, addTransfer } = useFinance()
  const { t } = useLang()
  const [view, setView] = useState('list') // list | form | transfer
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [transfer, setTransfer] = useState({ from: '', to: '', amount: '', note: '' })

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setView('form')
  }
  function openEdit(w) {
    setEditingId(w.id)
    setForm({ name: w.name, icon: w.icon, color: w.color, initialBalance: String(w.initialBalance ?? '') })
    setView('form')
  }
  function saveWallet() {
    if (!form.name.trim()) return
    const payload = { name: form.name.trim(), icon: form.icon, color: form.color, initialBalance: parseFloat(form.initialBalance) || 0 }
    if (editingId) updateWallet(editingId, payload)
    else addWallet(payload)
    setView('list')
  }
  function doTransfer() {
    const amount = parseFloat(transfer.amount)
    if (!transfer.from || !transfer.to || transfer.from === transfer.to || isNaN(amount) || amount <= 0) return
    addTransfer({ fromWalletId: transfer.from, toWalletId: transfer.to, amount, date: todayISO(), note: transfer.note })
    setTransfer({ from: '', to: '', amount: '', note: '' })
    setView('list')
  }

  const total = wallets.reduce((s, w) => s + (walletBalances[w.id] || 0), 0)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('กระเป๋าเงิน')}>
      {view === 'list' && (
        <div className="space-y-3">
          <div className="bg-primary-50 rounded-2xl p-4 text-center">
            <div className="text-xs text-slate-500 mb-0.5">{t('ยอดรวมทุกกระเป๋า')}</div>
            <div className="text-2xl font-bold text-primary-800">฿{formatMoney(total)}</div>
          </div>

          <div className="space-y-2">
            {wallets.map((w) => (
              <div key={w.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                <span className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: (w.color || '#999') + '22' }}>
                  {w.icon}
                </span>
                <button onClick={() => openEdit(w)} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium truncate">{t(w.name)}</div>
                  <div className="text-xs text-slate-400">{t('แตะเพื่อแก้ไข')}</div>
                </button>
                <span className={`text-sm font-bold ${(walletBalances[w.id] || 0) < 0 ? 'text-expense' : 'text-slate-700'}`}>
                  ฿{formatMoney(walletBalances[w.id] || 0)}
                </span>
                {wallets.length > 1 && (
                  <button onClick={() => deleteWallet(w.id)} className="text-slate-300 hover:text-expense text-lg flex-shrink-0">×</button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={openAdd} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold bg-gradient-to-br from-primary-600 to-primary-700">{t('+ เพิ่มกระเป๋า')}</button>
            {wallets.length > 1 && (
              <button onClick={() => { setTransfer({ from: wallets[0].id, to: wallets[1].id, amount: '', note: '' }); setView('transfer') }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-primary-300 text-primary-700">{t('🔄 โอนเงิน')}</button>
            )}
          </div>
        </div>
      )}

      {view === 'form' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: form.color + '22' }}>{form.icon}</span>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('ชื่อกระเป๋า เช่น ธนาคารกสิกร')} autoFocus
              className="flex-1 px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600" />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1.5">{t('ไอคอน')}</label>
            <div className="flex flex-wrap gap-1.5">
              {WALLET_ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center ${form.icon === ic ? 'bg-primary-200' : 'bg-slate-100'}`}>{ic}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1.5">{t('สี')}</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1.5">{t('ยอดเริ่มต้น (บาท)')}</label>
            <input type="number" step="0.01" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })}
              placeholder="0.00" className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm text-right focus:outline-none focus:border-primary-600" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setView('list')} className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600">{t('ยกเลิก')}</button>
            <button onClick={saveWallet} disabled={!form.name.trim()} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold bg-gradient-to-br from-primary-600 to-primary-700 disabled:opacity-40">{t('บันทึก')}</button>
          </div>
        </div>
      )}

      {view === 'transfer' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">{t('จากกระเป๋า')}</label>
              <select value={transfer.from} onChange={(e) => setTransfer({ ...transfer, from: e.target.value })}
                className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600 bg-white">
                {wallets.map((w) => <option key={w.id} value={w.id}>{w.icon} {t(w.name)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">{t('ไปกระเป๋า')}</label>
              <select value={transfer.to} onChange={(e) => setTransfer({ ...transfer, to: e.target.value })}
                className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600 bg-white">
                {wallets.map((w) => <option key={w.id} value={w.id}>{w.icon} {t(w.name)}</option>)}
              </select>
            </div>
          </div>
          {transfer.from === transfer.to && <p className="text-xs text-expense">{t('เลือกกระเป๋าต้นทาง/ปลายทางให้ต่างกัน')}</p>}
          <div className="relative">
            <input type="number" step="0.01" min="0" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })}
              placeholder="0.00" className="w-full pl-4 pr-12 py-4 border-2 border-slate-200 rounded-xl text-2xl font-bold text-right focus:outline-none focus:border-primary-600" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">฿</span>
          </div>
          <input type="text" value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} placeholder={t('หมายเหตุ (ไม่บังคับ)')}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-600" />
          <div className="flex gap-3">
            <button onClick={() => setView('list')} className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600">{t('ยกเลิก')}</button>
            <button onClick={doTransfer} disabled={transfer.from === transfer.to || !transfer.amount}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold bg-gradient-to-br from-primary-600 to-primary-700 disabled:opacity-40">{t('โอนเงิน')}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
