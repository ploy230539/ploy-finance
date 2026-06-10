import { useMemo, useState } from 'react'
import { useFinance } from '../contexts/FinanceContext'
import BudgetModal from '../components/BudgetModal'

function formatMoney(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
}

export default function Dashboard() {
  const { transactions, balance, installments, monthlyInstallmentTotal, getCategory, budgets } = useFinance()
  const [month, setMonth] = useState(currentMonth())
  const [showBudget, setShowBudget] = useState(false)

  const monthTx = useMemo(() => transactions.filter((t) => t.date?.startsWith(month)), [transactions, month])

  const monthIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthNet = monthIncome - monthExpense

  // Spend per category this month
  const spentByCat = useMemo(() => {
    const map = {}
    monthTx.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return map
  }, [monthTx])

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

  const recentTransactions = monthTx.slice(0, 6)
  const activeInstallments = installments.filter((i) => i.payments.some((p) => !p.paid))
  const isThisMonth = month === currentMonth()

  return (
    <div className="space-y-4 fade-in">
      {/* Month navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="w-10 h-10 rounded-xl hover:bg-slate-100 text-slate-500 text-lg">‹</button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-800">{monthLabel(month)}</div>
          {!isThisMonth && (
            <button onClick={() => setMonth(currentMonth())} className="text-[11px] text-primary-600">กลับเดือนนี้</button>
          )}
        </div>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={isThisMonth}
          className="w-10 h-10 rounded-xl hover:bg-slate-100 text-slate-500 text-lg disabled:opacity-25"
        >›</button>
      </div>

      {/* Monthly hero */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-[0_8px_24px_rgba(217,119,6,0.3)]">
        <div className="text-sm text-white/80 mb-1">คงเหลือสุทธิเดือนนี้</div>
        <div className="text-3xl font-bold mb-4">{monthNet < 0 ? '-' : ''}฿{formatMoney(Math.abs(monthNet))}</div>
        <div className="flex gap-3">
          <div className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 backdrop-blur-sm">
            <div className="text-[11px] text-white/80">รายรับ</div>
            <div className="text-base font-semibold">฿{formatMoney(monthIncome)}</div>
          </div>
          <div className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 backdrop-blur-sm">
            <div className="text-[11px] text-white/80">รายจ่าย</div>
            <div className="text-base font-semibold">฿{formatMoney(monthExpense)}</div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="ผ่อน / เดือน" value={monthlyInstallmentTotal} color="text-installment" emoji="💳" />
        <StatCard label="คงเหลือสะสม" value={balance} color={balance < 0 ? 'text-expense' : 'text-income'} emoji="🏦" />
      </div>

      {/* Budget tracking */}
      <Section
        title="🎯 งบประมาณเดือนนี้"
        action={<button onClick={() => setShowBudget(true)} className="text-xs text-primary-600 font-medium">ตั้งงบ</button>}
      >
        {budgetRows.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-3">ยังไม่ได้ตั้งงบ — แตะ "ตั้งงบ" เพื่อกำหนดวงเงินต่อหมวด</p>
        ) : (
          <div className="space-y-3.5">
            {budgetRows.map(({ category, limit, spent }) => {
              const pct = limit > 0 ? (spent / limit) * 100 : 0
              const over = spent > limit
              const color = over ? '#DC2626' : pct >= 80 ? '#D97706' : '#059669'
              return (
                <div key={category?.id || 'x'}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="font-medium flex items-center gap-1.5">
                      <span>{category?.icon || '📝'}</span>
                      {category?.name || 'ไม่ระบุ'}
                    </span>
                    <span className="text-xs" style={{ color }}>
                      ฿{formatMoney(spent)} / {formatMoney(limit)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                  </div>
                  {over && <div className="text-[11px] text-expense mt-1">⚠️ เกินงบ ฿{formatMoney(spent - limit)}</div>}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Active Installments */}
      {activeInstallments.length > 0 && (
        <Section title="💳 ผ่อนชำระที่ยังค้าง">
          <div className="space-y-3.5">
            {activeInstallments.map((inst) => {
              const paid = inst.payments.filter((p) => p.paid).length
              const total = inst.payments.length
              const pct = Math.round((paid / total) * 100)
              return (
                <div key={inst.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium truncate">{inst.name}</span>
                    <span className="text-xs text-slate-500">{paid}/{total} งวด</span>
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

      {/* Top Expenses (this month) */}
      {topExpenses.length > 0 && (
        <Section title="📊 หมวดหมู่รายจ่ายสูงสุด">
          <div className="space-y-3">
            {topExpenses.map(({ category, amount }) => {
              const pct = monthExpense > 0 ? (amount / monthExpense) * 100 : 0
              return (
                <div key={category?.id || 'unknown'} className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: (category?.color || '#999') + '20' }}>
                    {category?.icon || '📝'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{category?.name || 'ไม่ระบุ'}</span>
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

      {/* Recent (this month) */}
      <Section title="📋 รายการเดือนนี้">
        {recentTransactions.length === 0 ? (
          <EmptyState emoji="🪙" text="เดือนนี้ยังไม่มีรายการ — แตะปุ่ม + เพื่อเริ่มบันทึก!" />
        ) : (
          <div className="-my-1">
            {recentTransactions.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </Section>

      <BudgetModal isOpen={showBudget} onClose={() => setShowBudget(false)} />
    </div>
  )
}

function StatCard({ label, value, color, emoji, isCount }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
        <span>{emoji}</span>
        {label}
      </div>
      <div className={`text-xl font-bold ${color} truncate`}>
        {isCount ? value : `฿${formatMoney(value)}`}
      </div>
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
  const cat = getCategory(tx.category)
  const isIncome = tx.type === 'income'
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: (cat?.color || '#999') + '20' }}>
        {cat?.icon || '📝'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{tx.note || cat?.name}</div>
        <div className="text-xs text-slate-400">
          {new Date(tx.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
          {tx.splitWith?.length > 0 && ` · หาร ${tx.splitWith.length + 1} คน`}
        </div>
      </div>
      <span className={`text-sm font-bold ${isIncome ? 'text-income' : 'text-expense'}`}>
        {isIncome ? '+' : '-'}฿{formatMoney(tx.amount)}
      </span>
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
