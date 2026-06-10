import { useState, useMemo } from 'react'
import { useFinance } from '../contexts/FinanceContext'
import Modal from '../components/Modal'
import CategoryPicker from '../components/CategoryPicker'
import PhotoCapture from '../components/PhotoCapture'
import ReceiptViewer from '../components/ReceiptViewer'
import { CheckIcon } from '../components/Icons'

function formatMoney(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const emptyForm = {
  category: '',
  amount: '',
  note: '',
  date: new Date().toISOString().split('T')[0],
  splitWith: [],
  photo: null,
}

export default function SplitBill() {
  const {
    transactions, addTransaction, settleSplitPerson, people, addPerson, deletePerson,
    expenseCats, getCategory, addCustomCategory, deleteCustomCategory,
  } = useFinance()
  const [viewReceipt, setViewReceipt] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showPeopleModal, setShowPeopleModal] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [form, setForm] = useState(emptyForm)

  const splitTransactions = useMemo(
    () => transactions.filter((t) => t.splitWith?.length > 0),
    [transactions]
  )

  // Outstanding (ค้างรับ) vs received (รับแล้ว) per person
  const oweSummary = useMemo(() => {
    const summary = {}
    splitTransactions.forEach((tx) => {
      const perPerson = tx.amount / (tx.splitWith.length + 1)
      tx.splitWith.forEach((person) => {
        if (!summary[person]) summary[person] = { outstanding: 0, received: 0 }
        if (tx.settlements?.[person]?.received) summary[person].received += perPerson
        else summary[person].outstanding += perPerson
      })
    })
    return Object.entries(summary).sort((a, b) => b[1].outstanding - a[1].outstanding)
  }, [splitTransactions])

  const totalOutstanding = oweSummary.reduce((s, [, v]) => s + v.outstanding, 0)

  function togglePerson(name) {
    setForm((f) => ({
      ...f,
      splitWith: f.splitWith.includes(name)
        ? f.splitWith.filter((n) => n !== name)
        : [...f.splitWith, name],
    }))
  }

  function handleAddPerson() {
    const name = newPersonName.trim()
    if (!name) return
    addPerson(name)
    setNewPersonName('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.category || isNaN(amount) || amount <= 0 || form.splitWith.length === 0) return

    addTransaction({
      type: 'expense',
      category: form.category,
      amount,
      note: form.note || `หาร ${form.splitWith.length + 1} คน`,
      date: form.date,
      splitWith: form.splitWith,
      photo: form.photo,
    })
    setForm(emptyForm)
    setShowModal(false)
  }

  const splitCount = form.splitWith.length + 1
  const splitAmount = form.amount && splitCount > 1 ? parseFloat(form.amount) / splitCount : null

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">หารบิล</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPeopleModal(true)}
            className="bg-white text-slate-600 px-3 py-2.5 rounded-xl text-sm font-medium border-2 border-slate-200"
          >
            รายชื่อ
          </button>
          <button
            onClick={() => { setForm(emptyForm); setShowModal(true) }}
            className="bg-gradient-to-br from-split to-orange-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_12px_rgba(234,88,12,0.3)] active:translate-y-px transition-transform"
          >
            + สร้างบิล
          </button>
        </div>
      </div>

      {/* Owe summary */}
      {oweSummary.length > 0 && (
        <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="font-semibold text-slate-800">💰 ยอดค้างรับจากเพื่อน</h2>
            <span className="text-sm font-bold text-split">฿{formatMoney(totalOutstanding)}</span>
          </div>
          <div className="space-y-1">
            {oweSummary.map(([name, v]) => (
              <div key={name} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-split-light flex items-center justify-center text-sm font-bold text-split">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{name}</div>
                    {v.received > 0 && (
                      <div className="text-[10px] text-income">รับแล้ว ฿{formatMoney(v.received)}</div>
                    )}
                  </div>
                </div>
                {v.outstanding > 0 ? (
                  <span className="text-sm font-bold text-split">ค้าง ฿{formatMoney(v.outstanding)}</span>
                ) : (
                  <span className="text-xs font-semibold text-income">รับครบแล้ว ✓</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
        <h2 className="font-semibold text-slate-800 mb-3.5">📋 ประวัติบิลหาร</h2>
        {splitTransactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🧾</div>
            <p className="text-sm text-slate-400">ยังไม่มีบิลหาร</p>
          </div>
        ) : (
          <div className="-my-1">
            {splitTransactions.map((tx) => {
              const cat = getCategory(tx.category)
              const perPerson = tx.amount / (tx.splitWith.length + 1)
              const receivedCount = tx.splitWith.filter((p) => tx.settlements?.[p]?.received).length
              return (
                <div key={tx.id} className="py-3 border-b border-slate-50 last:border-0">
                  <div className="flex items-start gap-3">
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: (cat?.color || '#999') + '20' }}
                    >
                      {cat?.icon || '📝'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{tx.note || cat?.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(tx.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        {' · '}รวม ฿{formatMoney(tx.amount)} · คนละ ฿{formatMoney(perPerson)}
                      </div>
                    </div>
                    {tx.photo && (
                      <button onClick={() => setViewReceipt(tx.photo)} className="flex-shrink-0" title="ดูสลิป">
                        <img src={tx.photo} alt="สลิป" className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                      </button>
                    )}
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-slate-400">รับแล้ว</div>
                      <div className="text-sm font-bold text-income">{receivedCount}/{tx.splitWith.length}</div>
                    </div>
                  </div>

                  {/* Tap a person to mark "received money back" → auto-records income */}
                  <div className="flex flex-wrap gap-1.5 mt-2 pl-14">
                    {tx.splitWith.map((p) => {
                      const received = !!tx.settlements?.[p]?.received
                      return (
                        <button
                          key={p}
                          onClick={() => settleSplitPerson(tx.id, p)}
                          className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1 ${
                            received
                              ? 'bg-income-light text-income'
                              : 'bg-slate-100 text-slate-500 hover:bg-split-light hover:text-split'
                          }`}
                          title={received ? 'ได้รับเงินคืนแล้ว (แตะเพื่อยกเลิก)' : 'แตะเมื่อได้รับเงินคืนแล้ว'}
                        >
                          <span>{received ? '✅' : '⬜'}</span>
                          {p} ฿{formatMoney(perPerson)}
                        </button>
                      )
                    })}
                  </div>
                  {receivedCount > 0 && (
                    <div className="text-[10px] text-income mt-1.5 pl-14">
                      🤝 บันทึกเป็นรายรับอัตโนมัติแล้ว ฿{formatMoney(receivedCount * perPerson)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Create split modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="สร้างบิลหาร">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              className="w-full pl-4 pr-12 py-4 border-2 border-slate-200 rounded-xl text-2xl font-bold text-right focus:outline-none focus:border-split transition-colors"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">฿</span>
          </div>

          <Field label="หมวดหมู่">
            <CategoryPicker
              categories={expenseCats}
              selected={form.category}
              onSelect={(id) => setForm({ ...form, category: id })}
              onAddCategory={(cat) => addCustomCategory({ ...cat, type: 'expense' })}
              onDeleteCategory={deleteCustomCategory}
            />
          </Field>

          <Field label="หมายเหตุ">
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="เช่น ข้าวเย็น, ค่าห้อง..."
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-split transition-colors"
            />
          </Field>

          <Field label="วันที่">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-split transition-colors"
            />
          </Field>

          <Field label="🧾 สลิป/ใบเสร็จ (ไม่บังคับ)">
            <PhotoCapture value={form.photo} onChange={(photo) => setForm({ ...form, photo })} accent="#EA580C" />
          </Field>

          <Field label="เลือกคนที่จะหาร">
            {people.length === 0 ? (
              <p className="text-sm text-slate-400">
                ยังไม่มีรายชื่อ —{' '}
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setShowPeopleModal(true) }}
                  className="text-split underline font-medium"
                >
                  เพิ่มรายชื่อก่อน
                </button>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerson(p.name)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      form.splitWith.includes(p.name) ? 'bg-split text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </Field>

          {splitAmount && (
            <div className="bg-split-light rounded-2xl p-4 text-center">
              <div className="text-sm text-slate-600 mb-1">หาร {splitCount} คน (ฉัน + {form.splitWith.join(', ')})</div>
              <div className="text-2xl font-bold text-split">฿{formatMoney(splitAmount)} / คน</div>
            </div>
          )}

          <button
            type="submit"
            disabled={!form.category || !form.amount || form.splitWith.length === 0}
            className="w-full py-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 bg-gradient-to-br from-split to-orange-700 shadow-[0_4px_12px_rgba(234,88,12,0.3)] active:translate-y-px"
          >
            <CheckIcon width={20} height={20} />
            บันทึกบิลหาร
          </button>
        </form>
      </Modal>

      {/* People management modal */}
      <Modal isOpen={showPeopleModal} onClose={() => setShowPeopleModal(false)} title="จัดการรายชื่อ">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
              placeholder="ชื่อเพื่อน/คนที่จะหาร..."
              className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-split transition-colors"
            />
            <button onClick={handleAddPerson} className="px-4 py-3 bg-split text-white rounded-xl text-sm font-semibold">
              เพิ่ม
            </button>
          </div>

          {people.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีรายชื่อ</p>
          ) : (
            <div className="space-y-2">
              {people.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-split-light flex items-center justify-center text-sm font-bold text-split">
                      {p.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <button onClick={() => deletePerson(p.id)} className="text-slate-400 hover:text-expense transition-colors text-xl">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ReceiptViewer src={viewReceipt} onClose={() => setViewReceipt(null)} />
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
