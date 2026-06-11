import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { expenseCategories, incomeCategories, getCategoryById } from '../data/categories'
import { useAuth } from './AuthContext'
import { db, firebaseEnabled } from '../firebase'

function ymNow() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function makeRecurringTx(rule, ym) {
  return {
    id: uuidv4(),
    type: rule.type,
    category: rule.category,
    amount: rule.amount,
    note: (rule.note ? rule.note + ' · ' : '') + 'รายการประจำ',
    date: `${ym}-${String(rule.dayOfMonth).padStart(2, '0')}`,
    splitWith: [],
    createdAt: new Date().toISOString(),
    recurringId: rule.id,
  }
}

const FinanceContext = createContext()

function loadFromStorage(key, fallback) {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // Most likely the storage quota was exceeded (e.g. too many receipt photos)
    console.error('บันทึกข้อมูลไม่สำเร็จ:', e)
    if (e?.name === 'QuotaExceededError') {
      alert('พื้นที่จัดเก็บเต็ม — รูปสลิปอาจเยอะเกินไป ลองลบรายการเก่าหรือรูปบางรูปออก')
    }
  }
}

export function FinanceProvider({ children }) {
  const [transactions, setTransactions] = useState(() =>
    loadFromStorage('ploy_transactions', [])
  )
  const [installments, setInstallments] = useState(() =>
    loadFromStorage('ploy_installments', [])
  )
  const [people, setPeople] = useState(() =>
    loadFromStorage('ploy_people', [])
  )
  const [customCategories, setCustomCategories] = useState(() =>
    loadFromStorage('ploy_custom_categories', [])
  )
  const [budgets, setBudgets] = useState(() => loadFromStorage('ploy_budgets', {}))
  const [recurring, setRecurring] = useState(() => loadFromStorage('ploy_recurring', []))

  useEffect(() => saveToStorage('ploy_transactions', transactions), [transactions])
  useEffect(() => saveToStorage('ploy_installments', installments), [installments])
  useEffect(() => saveToStorage('ploy_people', people), [people])
  useEffect(() => saveToStorage('ploy_custom_categories', customCategories), [customCategories])
  useEffect(() => saveToStorage('ploy_budgets', budgets), [budgets])
  useEffect(() => saveToStorage('ploy_recurring', recurring), [recurring])

  // --- Firebase cloud sync (only when logged in) ---
  const { user } = useAuth()
  const [cloudReady, setCloudReady] = useState(false)
  const saveTimer = useRef(null)

  const snapshotData = useCallback(
    () => ({ transactions, installments, people, customCategories, budgets, recurring }),
    [transactions, installments, people, customCategories, budgets, recurring]
  )

  // Load the user's cloud data on login (migrate local → cloud on first login)
  useEffect(() => {
    if (!firebaseEnabled || !user) {
      setCloudReady(false)
      return
    }
    let cancelled = false
    setCloudReady(false)
    ;(async () => {
      try {
        const ref = doc(db, 'users', user.uid)
        const snap = await getDoc(ref)
        if (cancelled) return
        if (snap.exists()) {
          const d = snap.data()
          setTransactions(d.transactions || [])
          setInstallments(d.installments || [])
          setPeople(d.people || [])
          setCustomCategories(d.customCategories || [])
          setBudgets(d.budgets || {})
          setRecurring(d.recurring || [])
        } else {
          // first login on this account → seed cloud with whatever is local
          await setDoc(ref, { transactions, installments, people, customCategories, budgets, recurring })
        }
        if (!cancelled) setCloudReady(true)
      } catch (e) {
        console.error('โหลดข้อมูลคลาวด์ไม่สำเร็จ:', e)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  // Save to cloud (debounced) whenever data changes after the cloud is ready
  useEffect(() => {
    if (!firebaseEnabled || !user || !cloudReady) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setDoc(doc(db, 'users', user.uid), snapshotData()).catch((e) =>
        console.error('บันทึกขึ้นคลาวด์ไม่สำเร็จ:', e)
      )
    }, 800)
    return () => clearTimeout(saveTimer.current)
  }, [transactions, installments, people, customCategories, budgets, recurring, user, cloudReady, snapshotData])

  // On load: auto-post any recurring rule that is due this month and not yet posted.
  const recurringRan = useRef(false)
  useEffect(() => {
    if (recurringRan.current) return
    recurringRan.current = true
    const ym = ymNow()
    const dom = new Date().getDate()
    const due = recurring.filter(
      (r) =>
        r.active &&
        dom >= r.dayOfMonth &&
        !transactions.some((t) => t.recurringId === r.id && t.date?.startsWith(ym))
    )
    if (due.length === 0) return
    const dueIds = new Set(due.map((r) => r.id))
    setTransactions((prev) => [...due.map((r) => makeRecurringTx(r, ym)), ...prev])
    setRecurring((prev) => prev.map((r) => (dueIds.has(r.id) ? { ...r, lastPosted: ym } : r)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addTransaction = useCallback((tx) => {
    setTransactions((prev) => [{ ...tx, id: uuidv4(), createdAt: new Date().toISOString() }, ...prev])
  }, [])

  const deleteTransaction = useCallback((id) => {
    setTransactions((prev) =>
      prev.filter((t) => {
        if (t.id === id) return false
        // also remove any auto-created settlement income tied to this split
        if (t.meta?.settlementOf === id) return false
        return true
      })
    )
  }, [])

  const updateTransaction = useCallback((id, patch) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  // Toggle "received money back" for one person on a split bill.
  // When marked received → auto-create an income transaction; when un-marked → remove it.
  const settleSplitPerson = useCallback((txId, name) => {
    setTransactions((prev) => {
      const tx = prev.find((t) => t.id === txId)
      if (!tx) return prev
      const perPerson = tx.amount / ((tx.splitWith?.length || 0) + 1)
      const settlements = { ...(tx.settlements || {}) }
      const cur = settlements[name] || { received: false, incomeTxId: null }

      if (!cur.received) {
        const incomeTx = {
          id: uuidv4(),
          type: 'income',
          category: 'split_repay',
          amount: perPerson,
          note: `รับเงินหารคืนจาก ${name}` + (tx.note ? ` · ${tx.note}` : ''),
          date: new Date().toISOString().split('T')[0],
          splitWith: [],
          createdAt: new Date().toISOString(),
          meta: { settlementOf: txId, person: name },
        }
        settlements[name] = { received: true, incomeTxId: incomeTx.id }
        return [incomeTx, ...prev.map((t) => (t.id === txId ? { ...t, settlements } : t))]
      }

      const removeId = cur.incomeTxId
      settlements[name] = { received: false, incomeTxId: null }
      return prev
        .filter((t) => t.id !== removeId)
        .map((t) => (t.id === txId ? { ...t, settlements } : t))
    })
  }, [])

  const addInstallment = useCallback((inst) => {
    const id = uuidv4()
    const payments = Array.from({ length: inst.totalMonths }, (_, i) => ({
      month: i + 1,
      paid: false,
      dueDate: new Date(
        new Date(inst.startDate).getFullYear(),
        new Date(inst.startDate).getMonth() + i,
        new Date(inst.startDate).getDate()
      ).toISOString(),
    }))
    setInstallments((prev) => [
      { ...inst, id, payments, createdAt: new Date().toISOString() },
      ...prev,
    ])
  }, [])

  const toggleInstallmentPayment = useCallback((installmentId, monthIndex) => {
    setInstallments((prev) =>
      prev.map((inst) => {
        if (inst.id !== installmentId) return inst
        const payments = inst.payments.map((p, i) =>
          i === monthIndex ? { ...p, paid: !p.paid } : p
        )
        return { ...inst, payments }
      })
    )
  }, [])

  const deleteInstallment = useCallback((id) => {
    setInstallments((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const addPerson = useCallback((name) => {
    setPeople((prev) => {
      if (prev.find((p) => p.name === name)) return prev
      return [...prev, { id: uuidv4(), name }]
    })
  }, [])

  const deletePerson = useCallback((id) => {
    setPeople((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // --- Custom categories (user-created, with own emoji icon + color) ---
  const addCustomCategory = useCallback((cat) => {
    const newCat = { id: 'custom_' + uuidv4().slice(0, 8), custom: true, ...cat }
    setCustomCategories((prev) => [...prev, newCat])
    return newCat
  }, [])

  const deleteCustomCategory = useCallback((id) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // --- Recurring transactions ---
  const addRecurring = useCallback((rule) => {
    const id = uuidv4()
    const ym = ymNow()
    const dom = new Date().getDate()
    const dueNow = rule.active !== false && dom >= rule.dayOfMonth
    const newRule = { ...rule, id, active: rule.active !== false, lastPosted: dueNow ? ym : null }
    setRecurring((prev) => [newRule, ...prev])
    if (dueNow) setTransactions((prev) => [makeRecurringTx(newRule, ym), ...prev])
    return newRule
  }, [])

  const toggleRecurring = useCallback((id) => {
    setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
  }, [])

  const deleteRecurring = useCallback((id) => {
    setRecurring((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // --- Monthly budgets per category (standing limit, applies every month) ---
  const setBudget = useCallback((categoryId, amount) => {
    setBudgets((prev) => {
      const next = { ...prev }
      if (!amount || amount <= 0) delete next[categoryId]
      else next[categoryId] = amount
      return next
    })
  }, [])

  const expenseCats = useMemo(
    () => [...expenseCategories, ...customCategories.filter((c) => c.type === 'expense')],
    [customCategories]
  )
  const incomeCats = useMemo(
    () => [...incomeCategories, ...customCategories.filter((c) => c.type === 'income')],
    [customCategories]
  )

  // Resolve a category id to its definition (custom takes priority over built-in)
  const getCategory = useCallback(
    (id) => customCategories.find((c) => c.id === id) || getCategoryById(id),
    [customCategories]
  )

  // --- Backup / Restore ---
  const exportData = useCallback(
    () => ({
      app: 'ploy-finance',
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions,
      installments,
      people,
      customCategories,
      budgets,
      recurring,
    }),
    [transactions, installments, people, customCategories, budgets, recurring]
  )

  const importData = useCallback((data) => {
    if (!data || data.app !== 'ploy-finance' || !Array.isArray(data.transactions)) {
      throw new Error('ไฟล์สำรองไม่ถูกต้อง')
    }
    setTransactions(data.transactions || [])
    setInstallments(data.installments || [])
    setPeople(data.people || [])
    setCustomCategories(data.customCategories || [])
    setBudgets(data.budgets || {})
    setRecurring(data.recurring || [])
  }, [])

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const balance = totalIncome - totalExpense

  const monthlyInstallmentTotal = installments.reduce((sum, inst) => {
    const unpaid = inst.payments.filter((p) => !p.paid).length
    return unpaid > 0 ? sum + inst.monthlyAmount : sum
  }, 0)

  return (
    <FinanceContext.Provider
      value={{
        transactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        settleSplitPerson,
        installments,
        addInstallment,
        toggleInstallmentPayment,
        deleteInstallment,
        people,
        addPerson,
        deletePerson,
        customCategories,
        addCustomCategory,
        deleteCustomCategory,
        budgets,
        setBudget,
        recurring,
        addRecurring,
        toggleRecurring,
        deleteRecurring,
        expenseCats,
        incomeCats,
        getCategory,
        exportData,
        importData,
        totalIncome,
        totalExpense,
        balance,
        monthlyInstallmentTotal,
      }}
    >
      {children}
    </FinanceContext.Provider>
  )
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider')
  return ctx
}
