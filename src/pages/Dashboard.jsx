import { useMemo, useState } from 'react'
import { useFinance } from '../contexts/FinanceContext'
import { useLang } from '../contexts/LanguageContext'
import BudgetModal from '../components/BudgetModal'
import WalletsModal from '../components/WalletsModal'

function formatMoney(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const pad = (n) => String(n).padStart(2, '0')
function keyOf(mode, d) {
  const y = d.getFullYear()
  if (mode === 'year') return `${y}`
  if (mode === 'month') return `${y}-${pad(d.getMonth() + 1)}`
  return `${y}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function labelOf(mode, d) {
  if (mode === 'year') return d.toLocaleDateString('th-TH', { year: 'numeric' })
  if (mode === 'month') return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function shift(mode, d, delta) {
  const n = new Date(d)
  if (mode === 'year') n.setFullYear(n.getFullYear() + delta)
  else if (mode === 'month') n.setMonth(n.getMonth() + delta)
  else n.setDate(n.getDate() + delta)
  return n
}
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// Billing cycle range containing `ref`, starting on day `day` each month
function cycleRange(ref, day) {
  const d = new Date(ref)
  let start = new Date(d.getFullYear(), d.getMonth(), day)
  if (d.getDate() < day) start = new Date(d.getFullYear(), d.getMonth() - 1, day)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, day)
  return { start, end }
}

export default function Dashboard() {
  const { transactions, balance, installments, monthlyInstallmentTotal, getCategory, budgets, wallets, walletBalances, cycleStartDay } = useFinance()
  const { t, fmtDate } = useLang()
  const [mode, setMode] = useState('month')
  const [anchor, setAnchor] = useState(new Date())
  const [showBudget, setShowBudget] = useState(false)
  const [showWallets, setShowWallets] = useState(false)
  const walletsTotal = wallets.reduce((s, w) => s + (walletBalances[w.id] || 0), 0)

  const useCycle = mode === 'month' && cycleStartDay > 1
  const cyc = useMemo(() => (useCycle ? cycleRange(anchor, cycleStartDay) : null), [useCycle, anchor, cycleStartDay])
  const key = keyOf(mode, anchor)
  const isCurrent = useCycle
    ? (() => { const td = new Date(); return td >= cyc.start && td < cyc.end })()
    : key === keyOf(mode, new Date())

  const periodTx = useMemo(() => {
    if (useCycle) {
      const s = ymd(cyc.start), e = ymd(cyc.end)
      return transactions.filter((t) => t.date >= s && t.date < e)
    }
    return transactions.filter((t) => t.date?.startsWith(key))
  }, [transactions, key, useCycle, cyc])
  const periodIncome = periodTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const periodExpense = periodTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const periodNet = periodIncome - periodExpense

  const spentByCat = useMemo(() => {
    const map = {}
    periodTx.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return map
  }, [periodTx])

  const topExpenses = useMemo(
    () =>
      Object.entries(spentByCat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([catId, amount]) => ({ category: getCategory(catId), amount })),
    [spentByCat, getCategory]
  )

  const budgetRows = useMemo(
    () =>
      Object.entries(budgets)
        .map(([catId, limit]) => ({ category: getCategory(catId), limit, spent: spentByCat[catId] || 0 }))
        .sort((a, b) => b.spent / b.limit - a.spent / a.limit),
    [budgets, spentByCat, getCategory]
  )

  // Year mode: income/expense per month
  const yearMonths = useMemo(() => {
    if (mode !== 'year') return []
    const y = anchor.getFullYear()
    const arr = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }))
    transactions.forEach((t) => {
      if (!t.date?.startsWith(`${y}`)) return
      const mo = Number(t.date.slice(5, 7)) - 1
      if (mo < 0 || mo > 11) return
      if (t.type === 'income') arr[mo].income += t.amount
      else if (t.type === 'expense') arr[mo].expense += t.amount
    })
    return arr
  }, [mode, anchor, transactions])
  const yearMax = Math.max(1, ...yearMonths.map((m) => Math.max(m.income, m.expense)))

  const listTx = mode === 'day' ? periodTx : periodTx.slice(0, 6)
  const activeInstallments = installments.filter((i) => i.payments.some((p) => !p.paid))

  const navLabel = useCycle
    ? `${fmtDate(cyc.start, { day: 'numeric', month: 'short' })} – ${fmtDate(new Date(cyc.end.getFullYear(), cyc.end.getMonth(), cyc.end.getDate() - 1), { day: 'numeric', month: 'short', year: '2-digit' })}`
    : labelOf(mode, anchor)
  const netLabel = t(mode === 'day' ? 'คงเหลือสุทธิวันนี้' : mode === 'year' ? 'คงเหลือสุทธิปีนี้' : 'คงเหลือสุทธิเดือนนี้')
  const emptyText = t(mode === 'day' ? 'วันนี้ยังไม่มีรายการ — แตะปุ่ม + เพื่อเริ่มบันทึก!' : mode === 'year' ? 'ปีนี้ยังไม่มีรายการ — แตะปุ่ม + เพื่อเริ่มบันทึก!' : 'เดือนนี้ยังไม่มีรายการ — แตะปุ่ม + เพื่อเริ่มบันทึก!')

  return (
    <div className="space-y-4 fade-in">
      {/* Period mode toggle */}
      <div className="flex rounded-2xl overflow-hidden border-2 border-slate-200 bg-white">
        {[
          { k: 'day', label: 'รายวัน' },
          { k: 'month', label: 'รายเดือน' },
          { k: 'year', label: 'รายปี' },
        ].map((opt) => (
          <button
            key={opt.k}
            onClick={() => { setMode(opt.k); setAnchor(new Date()) }}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mode === opt.k ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white' : 'text-slate-500'}`}
          >
            {t(opt.label)}
          </button>
        ))}
      </div>

      {/* Navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <button onClick={() => setAnchor(shift(mode, anchor, -1))} className="w-10 h-10 rounded-xl hover:bg-slate-100 text-slate-500 text-lg">‹</button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-800">{navLabel}</div>
          {!isCurrent && <button onClick={() => setAnchor(new Date())} className="text-[11px] text-primary-600">{t('กลับปัจจุบัน')}</button>}
        </div>
        <button onClick={() => setAnchor(shift(mode, anchor, 1))} disabled={isCurrent} className="w-10 h-10 rounded-xl hover:bg-slate-100 text-slate-500 text-lg disabled:opacity-25">›</button>
      </div>

      {/* Hero */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-[0_8px_24px_rgba(217,119,6,0.3)]">
        <div className="text-sm text-white/80 mb-1">{netLabel}</div>
        <div className="text-3xl font-bold mb-4">{periodNet < 0 ? '-' : ''}฿{formatMoney(Math.abs(periodNet))}</div>
        <div className="flex gap-3">
          <div className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 backdrop-blur-sm">
            <div className="text-[11px] text-white/80">{t('รายรับ')}</div>
            <div className="text-base font-semibold">฿{formatMoney(periodIncome)}</div>
          </div>
          <div className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 backdrop-blur-sm">
            <div className="text-[11px] text-white/80">{t('รายจ่าย')}</div>
            <div className="text-base font-semibold">฿{formatMoney(periodExpense)}</div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t('ผ่อน / เดือน')} value={monthlyInstallmentTotal} color="text-installment" emoji="💳" />
        <StatCard label={t('คงเหลือสะสม')} value={balance} color={balance < 0 ? 'text-expense' : 'text-income'} emoji="🏦" />
      </div>

      {/* Wallets */}
      <Section title={t('💰 กระเป๋าเงิน')} action={<button onClick={() => setShowWallets(true)} className="text-xs text-primary-600 font-medium">{t('จัดการ / โอน')}</button>}>
        <div className="space-y-2.5">
          {wallets.map((w) => (
            <div key={w.id} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ backgroundColor: (w.color || '#999') + '22' }}>{w.icon}</span>
              <span className="flex-1 text-sm font-medium truncate">{t(w.name)}</span>
              <span className={`text-sm font-bold ${(walletBalances[w.id] || 0) < 0 ? 'text-expense' : 'text-slate-700'}`}>฿{formatMoney(walletBalances[w.id] || 0)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
            <span className="text-sm font-semibold">{t('รวมทุกกระเป๋า')}</span>
            <span className="text-sm font-bold text-primary-800">฿{formatMoney(walletsTotal)}</span>
          </div>
        </div>
      </Section>

      {/* Year chart: income/expense per month */}
      {mode === 'year' && (
        <Section title={t('📈 สรุปรายเดือน')}>
          <div className="flex items-end justify-between gap-1 h-40 mb-2">
            {yearMonths.map((m, i) => {
              const thisMo = anchor.getFullYear() === new Date().getFullYear() && i === new Date().getMonth()
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
                  <div className="w-full flex items-end justify-center gap-[2px] h-full">
                    <div className="w-1/2 bg-income/80 rounded-t" style={{ height: `${(m.income / yearMax) * 100}%` }} title={`รับ ฿${formatMoney(m.income)}`} />
                    <div className="w-1/2 bg-expense/80 rounded-t" style={{ height: `${(m.expense / yearMax) * 100}%` }} title={`จ่าย ฿${formatMoney(m.expense)}`} />
                  </div>
                  <span className={`text-[9px] ${thisMo ? 'text-primary-700 font-bold' : 'text-slate-400'}`}>{MONTHS_TH[i].replace('.', '')}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-income/80" /> {t('รายรับ')}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-expense/80" /> {t('รายจ่าย')}</span>
          </div>
        </Section>
      )}

      {/* Budget (month mode only) */}
      {mode === 'month' && (
        <Section title={t('🎯 งบประมาณเดือนนี้')} action={<button onClick={() => setShowBudget(true)} className="text-xs text-primary-600 font-medium">{t('ตั้งงบ')}</button>}>
          {budgetRows.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-3">{t('ยังไม่ได้ตั้งงบ — แตะ "ตั้งงบ" เพื่อกำหนดวงเงินต่อหมวด')}</p>
          ) : (
            <div className="space-y-3.5">
              {budgetRows.map(({ category, limit, spent }) => {
                const pct = limit > 0 ? (spent / limit) * 100 : 0
                const over = spent > limit
                const color = over ? '#DC2626' : pct >= 80 ? '#D97706' : '#059669'
                return (
                  <div key={category?.id || 'x'}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="font-medium flex items-center gap-1.5"><span>{category?.icon || '📝'}</span>{category ? t(category.name) : t('ไม่ระบุ')}</span>
                      <span className="text-xs" style={{ color }}>฿{formatMoney(spent)} / {formatMoney(limit)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                    </div>
                    {over && <div className="text-[11px] text-expense mt-1">⚠️ {t('เกินงบ')} ฿{formatMoney(spent - limit)}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      )}

      {/* Active installments */}
      {activeInstallments.length > 0 && (
        <Section title={t('💳 ผ่อนชำระที่ยังค้าง')}>
          <div className="space-y-3.5">
            {activeInstallments.map((inst) => {
              const paid = inst.payments.filter((p) => p.paid).length
              const total = inst.payments.length
              const pct = Math.round((paid / total) * 100)
              return (
                <div key={inst.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium truncate">{inst.name}</span>
                    <span className="text-xs text-slate-500">{paid}/{total} {t('งวด')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-installment to-violet-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-9 text-right">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Top categories (month & year) */}
      {mode !== 'day' && topExpenses.length > 0 && (
        <Section title={t('📊 หมวดหมู่รายจ่ายสูงสุด')}>
          <div className="space-y-3">
            {topExpenses.map(({ category, amount }) => {
              const pct = periodExpense > 0 ? (amount / periodExpense) * 100 : 0
              return (
                <div key={category?.id || 'unknown'} className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: (category?.color || '#999') + '20' }}>{category?.icon || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{category ? t(category.name) : t('ไม่ระบุ')}</span>
                      <span className="font-semibold">฿{formatMoney(amount)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: category?.color || '#999' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Transactions for the period */}
      <Section title={t(mode === 'day' ? '📋 รายการวันนี้' : mode === 'year' ? '📋 รายการล่าสุดปีนี้' : '📋 รายการเดือนนี้')}>
        {listTx.length === 0 ? (
          <EmptyState emoji="🪙" text={emptyText} />
        ) : (
          <div className="-my-1">
            {listTx.map((tx) => <TxRow key={tx.id} tx={tx} />)}
          </div>
        )}
      </Section>

      <BudgetModal isOpen={showBudget} onClose={() => setShowBudget(false)} />
      <WalletsModal isOpen={showWallets} onClose={() => setShowWallets(false)} />
    </div>
  )
}

function StatCard({ label, value, color, emoji, isCount }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5"><span>{emoji}</span>{label}</div>
      <div className={`text-xl font-bold ${color} truncate`}>{isCount ? value : `฿${formatMoney(value)}`}</div>
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <section className="bg-white rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function TxRow({ tx }) {
  const { getCategory } = useFinance()
  const { t, fmtDate } = useLang()
  if (tx.type === 'transfer') {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-slate-100">🔄</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{tx.note || t('โอนเงิน')}</div>
          <div className="text-xs text-slate-400">{fmtDate(tx.date, { day: 'numeric', month: 'short', year: '2-digit' })}</div>
        </div>
        <span className="text-sm font-bold text-slate-500">฿{formatMoney(tx.amount)}</span>
      </div>
    )
  }
  const cat = getCategory(tx.category)
  const isIncome = tx.type === 'income'
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: (cat?.color || '#999') + '20' }}>{cat?.icon || '📝'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{tx.note || (cat ? t(cat.name) : '')}</div>
        <div className="text-xs text-slate-400">
          {fmtDate(tx.date, { day: 'numeric', month: 'short', year: '2-digit' })}
          {tx.splitWith?.length > 0 && ` · ${t('หาร')} ${tx.splitWith.length + 1} ${t('คน')}`}
        </div>
      </div>
      <span className={`text-sm font-bold ${isIncome ? 'text-income' : 'text-expense'}`}>{isIncome ? '+' : '-'}฿{formatMoney(tx.amount)}</span>
    </div>
  )
}

function EmptyState({ emoji, text }) {
  return (
    <div className="text-center py-8">
      <div className="text-5xl mb-3">{emoji}</div>
      <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
    </div>
  )
}
