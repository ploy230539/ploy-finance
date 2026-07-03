import { useState, useMemo } from 'react'
import { useFinance } from '../contexts/FinanceContext'
import { useLang } from '../contexts/LanguageContext'
import { loanTypes, getLoanType } from '../data/categories'
import { todayISO } from '../utils/date'
import Modal from '../components/Modal'
import { CheckIcon } from '../components/Icons'

function formatMoney(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const emptyForm = {
  loanType: 'credit',
  name: '',
  totalAmount: '',
  totalMonths: '',
  monthlyAmount: '',
  interestRate: '',
  startDate: todayISO(),
  cardName: '',
}

export default function Installments() {
  const { installments, addInstallment, toggleInstallmentPayment, deleteInstallment } = useFinance()
  const { t, fmtDate } = useLang()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')

  function handleTotalChange(totalAmount, totalMonths) {
    const ta = parseFloat(totalAmount) || 0
    const tm = parseInt(totalMonths) || 0
    const monthly = ta > 0 && tm > 0 ? ta / tm : 0
    setForm((f) => ({ ...f, totalAmount, totalMonths, monthlyAmount: monthly > 0 ? monthly.toFixed(2) : '' }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const totalAmount = parseFloat(form.totalAmount)
    const totalMonths = parseInt(form.totalMonths)
    const monthlyAmount = parseFloat(form.monthlyAmount)
    if (!form.name || isNaN(totalAmount) || isNaN(totalMonths) || isNaN(monthlyAmount)) return
    if (totalAmount <= 0 || totalMonths <= 0 || monthlyAmount <= 0) return

    addInstallment({
      loanType: form.loanType,
      name: form.name,
      totalAmount,
      totalMonths,
      monthlyAmount,
      interestRate: form.interestRate ? parseFloat(form.interestRate) : null,
      startDate: form.startDate,
      cardName: form.cardName,
    })
    setForm(emptyForm)
    setShowModal(false)
  }

  // Only types that actually have entries (plus "all")
  const presentTypes = useMemo(() => {
    const ids = new Set(installments.map((i) => i.loanType || 'credit'))
    return loanTypes.filter((t) => ids.has(t.id))
  }, [installments])

  const visible = useMemo(
    () => (filter === 'all' ? installments : installments.filter((i) => (i.loanType || 'credit') === filter)),
    [installments, filter]
  )

  const grandRemaining = installments.reduce((sum, inst) => {
    const unpaid = inst.payments.filter((p) => !p.paid).length
    return sum + inst.monthlyAmount * unpaid
  }, 0)
  const grandMonthly = installments.reduce((sum, inst) => {
    const unpaid = inst.payments.filter((p) => !p.paid).length
    return unpaid > 0 ? sum + inst.monthlyAmount : sum
  }, 0)

  const isLongTerm = ['personal', 'car', 'house', 'other'].includes(form.loanType)

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">{t('หนี้สิน & ผ่อนชำระ')}</h1>
        <button
          onClick={() => { setForm({ ...emptyForm, startDate: todayISO() }); setShowModal(true) }}
          className="bg-gradient-to-br from-installment to-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_12px_rgba(124,58,237,0.3)] active:translate-y-px transition-transform"
        >
          {t('+ เพิ่มรายการ')}
        </button>
      </div>

      {/* Grand summary */}
      {installments.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-installment-light rounded-2xl p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">{t('หนี้คงเหลือทั้งหมด')}</div>
            <div className="text-xl font-bold text-installment">฿{formatMoney(grandRemaining)}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="text-xs text-slate-500 mb-1">{t('ต้องผ่อน/เดือน')}</div>
            <div className="text-xl font-bold text-primary-700">฿{formatMoney(grandMonthly)}</div>
          </div>
        </div>
      )}

      {/* Type filter */}
      {presentTypes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            {t('ทั้งหมด')}
          </FilterChip>
          {presentTypes.map((lt) => (
            <FilterChip key={lt.id} active={filter === lt.id} onClick={() => setFilter(lt.id)}>
              {lt.icon} {t(lt.name)}
            </FilterChip>
          ))}
        </div>
      )}

      {installments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] py-12 text-center">
          <div className="text-5xl mb-3">🏦</div>
          <p className="text-sm text-slate-400">{t('ยังไม่มีหนี้สิน/รายการผ่อน')}</p>
        </div>
      ) : (
        visible.map((inst) => {
          const type = getLoanType(inst.loanType)
          const paid = inst.payments.filter((p) => p.paid).length
          const total = inst.payments.length
          const pct = Math.round((paid / total) * 100)
          const remaining = inst.monthlyAmount * (total - paid)
          const isExpanded = expandedId === inst.id
          const allPaid = paid === total

          return (
            <div
              key={inst.id}
              className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden border-l-4"
              style={{ borderLeftColor: type.color }}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : inst.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: type.color + '22' }}
                >
                  {type.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold truncate">{inst.name}</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: type.color + '1a', color: type.color }}
                    >
                      {t(type.name)}
                    </span>
                    {allPaid && (
                      <span className="text-[10px] bg-income-light text-income px-2 py-0.5 rounded-full font-semibold">{t('ปิดหนี้แล้ว')} ✓</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {inst.cardName && `${inst.cardName} · `}฿{formatMoney(inst.monthlyAmount)}/ด · {paid}/{total} {t('งวด')}
                    {inst.interestRate ? ` · ${t('ดอกเบี้ย')} ${inst.interestRate}%` : ''}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: allPaid ? 'var(--color-income)' : type.color }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-9 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-slate-400">{t('คงเหลือ')}</div>
                  <div className="text-sm font-bold" style={{ color: type.color }}>฿{formatMoney(remaining)}</div>
                </div>
                <span className={`text-slate-300 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{t('ยอดรวม')}: ฿{formatMoney(inst.totalAmount)}</span>
                    <button onClick={() => deleteInstallment(inst.id)} className="text-expense hover:underline">
                      {t('ลบรายการ')}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {inst.payments.map((payment, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleInstallmentPayment(inst.id, idx)}
                        className={`p-2 rounded-xl text-xs text-center transition-all border-2 ${
                          payment.paid
                            ? 'bg-income-light border-income/30 text-income'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-installment'
                        }`}
                      >
                        <div className="font-semibold">{t('งวด')} {payment.month}</div>
                        <div className="text-[10px] mt-0.5">
                          {fmtDate(payment.dueDate, { month: 'short', year: '2-digit' })}
                        </div>
                        <div className="mt-1">{payment.paid ? '✅' : '⬜'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={t('เพิ่มหนี้สิน / รายการผ่อน')}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Loan type selector */}
          <Field label={t('ประเภท')}>
            <div className="grid grid-cols-3 gap-2">
              {loanTypes.map((lt) => {
                const active = form.loanType === lt.id
                return (
                  <button
                    key={lt.id}
                    type="button"
                    onClick={() => setForm({ ...form, loanType: lt.id })}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-[11px] font-medium border-2 transition-all ${
                      active ? 'font-semibold' : 'border-transparent bg-slate-50 text-slate-600'
                    }`}
                    style={active ? { borderColor: lt.color, backgroundColor: lt.color + '14', color: lt.color } : undefined}
                  >
                    <span className="text-xl">{lt.icon}</span>
                    <span className="text-center leading-tight">{t(lt.name)}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label={t('ชื่อรายการ')}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={form.loanType === 'house' ? 'เช่น บ้านเดี่ยว, คอนโด...' : form.loanType === 'car' ? 'เช่น Toyota Yaris...' : form.loanType === 'personal' ? 'เช่น สินเชื่อ KTC...' : 'เช่น iPhone 16, แอร์...'}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-installment transition-colors"
              required
            />
          </Field>

          <Field label={t(form.loanType === 'credit' ? 'ชื่อบัตรเครดิต' : 'ธนาคาร/ผู้ให้สินเชื่อ')}>
            <input
              type="text"
              value={form.cardName}
              onChange={(e) => setForm({ ...form, cardName: e.target.value })}
              placeholder={form.loanType === 'credit' ? 'เช่น KBank, SCB...' : 'เช่น ธนาคารออมสิน, SCB...'}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-installment transition-colors"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('ยอดรวม (บาท)')}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.totalAmount}
                onChange={(e) => handleTotalChange(e.target.value, form.totalMonths)}
                placeholder="0.00"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-installment transition-colors"
                required
              />
            </Field>
            <Field label={t('จำนวนงวด')}>
              <input
                type="number"
                min="1"
                max="480"
                value={form.totalMonths}
                onChange={(e) => handleTotalChange(form.totalAmount, e.target.value)}
                placeholder={isLongTerm ? 'เช่น 240' : 'เช่น 10'}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-installment transition-colors"
                required
              />
            </Field>
          </div>

          <Field label={t('ดอกเบี้ย % ต่อปี (ไม่บังคับ)')}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.interestRate}
              onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
              placeholder="เช่น 3.5"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-installment transition-colors"
            />
          </Field>

          {form.monthlyAmount && (
            <div className="bg-installment-light rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 mb-0.5">
                {t('ผ่อนเดือนละ')} {form.totalMonths ? `(${form.totalMonths} ${t('งวด')} ≈ ${(parseInt(form.totalMonths) / 12).toFixed(1)} ${t('ปี')})` : ''}
              </div>
              <div className="text-xl font-bold text-installment">฿{formatMoney(parseFloat(form.monthlyAmount))}</div>
            </div>
          )}

          <Field label={t('เริ่มผ่อนวันที่')}>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-installment transition-colors"
            />
          </Field>

          <button
            type="submit"
            disabled={!form.name || !form.totalAmount || !form.totalMonths}
            className="w-full py-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 bg-gradient-to-br from-installment to-violet-700 shadow-[0_4px_12px_rgba(124,58,237,0.3)] active:translate-y-px"
          >
            <CheckIcon width={20} height={20} />
            {t('บันทึก')}
          </button>
        </form>
      </Modal>
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

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all ${
        active ? 'border-installment bg-installment-light text-installment' : 'border-slate-200 bg-white text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}
