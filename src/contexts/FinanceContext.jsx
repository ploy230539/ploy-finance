import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { expenseCategories, incomeCategories, getCategoryById } from '../data/categories'
import { perHead, billModeOf } from '../utils/split'
import { todayISO } from '../utils/date'
import { registerFlush } from '../utils/flushBus'
import { useAuth } from './AuthContext'
import { db, firebaseEnabled } from '../firebase'

function ymNow() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const DEFAULT_WALLET = { id: 'w_cash', name: 'เงินสด', type: 'cash', icon: '💵', color: '#059669', initialBalance: 0 }

// Wording of the auto-created income when someone pays us back
const REPAY_NOTE = {
  split: 'รับเงินหารคืนจาก',
  proxy: 'รับเงินค่าฝากซื้อจาก',
  lend: 'รับเงินยืมคืนจาก',
}

// Union two arrays by id — cloud wins on conflicts, local-only items survive,
// anything deleted (tombstoned) on either side is dropped. Never blindly overwrite:
// that is what used to wipe entries that hadn't reached the cloud yet.
function mergeById(cloud, local, dead) {
  const c = (Array.isArray(cloud) ? cloud : []).filter((x) => x && x.id && !dead.has(x.id))
  const l = (Array.isArray(local) ? local : []).filter((x) => x && x.id && !dead.has(x.id))
  if (l.length === 0) return c
  const ids = new Set(c.map((x) => x.id))
  return [...c, ...l.filter((x) => !ids.has(x.id))]
}

// --- Tombstones: remember what was deleted so a merge can't resurrect it ---
const TOMB_MAX = 2000
const TOMB_DAYS = 180

function pruneTombs(list) {
  const cutoff = Date.now() - TOMB_DAYS * 86400000
  const seen = new Set()
  const out = []
  for (const d of list) {
    if (!d || !d.id || seen.has(d.id)) continue
    if (d.at && d.at < cutoff) continue
    seen.add(d.id)
    out.push(d)
  }
  return out.slice(-TOMB_MAX)
}

function mergeTombs(a, b) {
  return pruneTombs([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])
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
  const [cycleStartDay, setCycleStartDayState] = useState(() => loadFromStorage('ploy_cycle_day', 1))
  const [wallets, setWallets] = useState(() => {
    const w = loadFromStorage('ploy_wallets', null)
    return w && w.length ? w : [DEFAULT_WALLET]
  })
  const [deletedIds, setDeletedIds] = useState(() => loadFromStorage('ploy_deleted', []))

  // Current tombstones, readable synchronously (cloud snapshots need them immediately)
  const deadRef = useRef(deletedIds)
  useEffect(() => { deadRef.current = deletedIds }, [deletedIds])

  const tombstone = useCallback((ids) => {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean)
    if (list.length === 0) return
    const at = Date.now()
    setDeletedIds((prev) => pruneTombs([...prev, ...list.map((id) => ({ id, at }))]))
  }, [])

  useEffect(() => saveToStorage('ploy_transactions', transactions), [transactions])
  useEffect(() => saveToStorage('ploy_installments', installments), [installments])
  useEffect(() => saveToStorage('ploy_people', people), [people])
  useEffect(() => saveToStorage('ploy_custom_categories', customCategories), [customCategories])
  useEffect(() => saveToStorage('ploy_budgets', budgets), [budgets])
  useEffect(() => saveToStorage('ploy_recurring', recurring), [recurring])
  useEffect(() => saveToStorage('ploy_wallets', wallets), [wallets])
  useEffect(() => saveToStorage('ploy_cycle_day', cycleStartDay), [cycleStartDay])
  useEffect(() => saveToStorage('ploy_deleted', deletedIds), [deletedIds])

  const setCycleStartDay = useCallback((d) => {
    const n = parseInt(d)
    setCycleStartDayState(Number.isFinite(n) && n >= 1 && n <= 28 ? n : 1)
  }, [])

  // --- Firebase cloud sync (only when logged in) ---
  const { user } = useAuth()
  const [cloudReady, setCloudReady] = useState(false)
  const saveTimer = useRef(null)

  const snapshotData = useCallback(
    () => ({ transactions, installments, people, customCategories, budgets, recurring, wallets, cycleStartDay, deletedIds }),
    [transactions, installments, people, customCategories, budgets, recurring, wallets, cycleStartDay, deletedIds]
  )

  // JSON of what's currently in sync with the cloud — used to ignore our own write echoes
  const lastCloudJSON = useRef(null)

  // Real-time cloud sync: live two-way updates across devices (same account)
  useEffect(() => {
    if (!firebaseEnabled || !user) {
      setCloudReady(false)
      lastCloudJSON.current = null
      return
    }
    setCloudReady(false)
    const ref = doc(db, 'users', user.uid)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // first login on this account → seed cloud with local data
          const data = snapshotData()
          lastCloudJSON.current = JSON.stringify(data)
          setDoc(ref, data).catch(() => {})
          setCloudReady(true)
          return
        }
        const d = snap.data()
        const shaped = {
          transactions: d.transactions || [],
          installments: d.installments || [],
          people: d.people || [],
          customCategories: d.customCategories || [],
          budgets: d.budgets || {},
          recurring: d.recurring || [],
          wallets: d.wallets?.length ? d.wallets : [DEFAULT_WALLET],
          cycleStartDay: d.cycleStartDay || 1,
          deletedIds: d.deletedIds || [],
        }
        const json = JSON.stringify(shaped)
        if (json === lastCloudJSON.current) {
          setCloudReady(true)
          return // our own write echoing back — ignore (prevents loop)
        }
        lastCloudJSON.current = json

        // Deletions from both sides, applied to both sides of the merge
        const tombs = mergeTombs(shaped.deletedIds, deadRef.current)
        const dead = new Set(tombs.map((x) => x.id))
        deadRef.current = tombs
        setDeletedIds(tombs)

        // ALWAYS merge — a snapshot must never delete something we haven't uploaded yet.
        // (Firestore delivers cache first then server; the old replace-on-2nd-snapshot
        // path wiped entries that were still waiting to sync.)
        setTransactions((prev) => mergeById(shaped.transactions, prev, dead))
        setInstallments((prev) => mergeById(shaped.installments, prev, dead))
        setPeople((prev) => mergeById(shaped.people, prev, dead))
        setCustomCategories((prev) => mergeById(shaped.customCategories, prev, dead))
        setRecurring((prev) => mergeById(shaped.recurring, prev, dead))
        setBudgets((prev) => ({ ...prev, ...shaped.budgets }))
        setWallets((prev) => { const m = mergeById(shaped.wallets, prev, dead); return m.length ? m : [DEFAULT_WALLET] })
        setCycleStartDayState(shaped.cycleStartDay)
        setCloudReady(true)
      },
      (e) => console.error('cloud sync error:', e)
    )
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  // Save to cloud (debounced) whenever local data changes — skip if it matches cloud
  useEffect(() => {
    if (!firebaseEnabled || !user || !cloudReady) return
    const data = snapshotData()
    const json = JSON.stringify(data)
    if (json === lastCloudJSON.current) return // already in sync (incl. just-applied remote update)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      lastCloudJSON.current = json
      setDoc(doc(db, 'users', user.uid), data).catch((e) => console.error('บันทึกขึ้นคลาวด์ไม่สำเร็จ:', e))
    }, 600)
    return () => clearTimeout(saveTimer.current)
  }, [transactions, installments, people, customCategories, budgets, recurring, wallets, cycleStartDay, deletedIds, user, cloudReady, snapshotData])

  // Flush to cloud immediately when the app is closed / backgrounded / reloaded
  const snapRef = useRef(snapshotData)
  useEffect(() => { snapRef.current = snapshotData }, [snapshotData])
  useEffect(() => {
    if (!firebaseEnabled) return
    const flush = () => {
      if (!user || !cloudReady) return
      const data = snapRef.current()
      const json = JSON.stringify(data)
      if (json === lastCloudJSON.current) return
      clearTimeout(saveTimer.current)
      lastCloudJSON.current = json
      try { return setDoc(doc(db, 'users', user.uid), data).catch(() => {}) } catch { /* best effort */ }
    }
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    // Sign-out clears the local cache — let it push anything unsynced first
    const unregister = registerFlush(flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVis)
      unregister()
    }
  }, [user, cloudReady])

  // On load: auto-post any recurring rule that is due this month and not yet posted.
  // Waits for the cloud data to arrive first, otherwise it would re-post rules that
  // another device already posted (duplicates).
  const recurringRan = useRef(false)
  const waitForCloud = firebaseEnabled && !!user && !cloudReady
  useEffect(() => {
    if (recurringRan.current || waitForCloud) return
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
  }, [waitForCloud])

  const addTransaction = useCallback((tx) => {
    setTransactions((prev) => [{ ...tx, id: uuidv4(), createdAt: new Date().toISOString() }, ...prev])
  }, [])

  // Current transactions, readable synchronously (so deletes can be tombstoned exactly)
  const txRef = useRef(transactions)
  useEffect(() => { txRef.current = transactions }, [transactions])

  const deleteTransaction = useCallback((id) => {
    // also remove any auto-created settlement income tied to this split
    const gone = [id, ...txRef.current.filter((t) => t.meta?.settlementOf === id).map((t) => t.id)]
    const dead = new Set(gone)
    setTransactions((prev) => prev.filter((t) => !dead.has(t.id)))
    tombstone(gone)
  }, [tombstone])

  const updateTransaction = useCallback((id, patch) => {
    setTransactions((prev) => {
      const target = prev.find((t) => t.id === id)
      if (!target) return prev
      const updated = { ...target, ...patch }

      // Editing a split bill's amount must also correct the income entries
      // already recorded for whoever paid us back — otherwise the ledger keeps
      // the old per-head share forever.
      const per = perHead(updated)
      const linked = new Set(
        Object.values(updated.settlements || {})
          .filter((s) => s?.received && s.incomeTxId)
          .map((s) => s.incomeTxId)
      )

      return prev.map((t) => {
        if (t.id === id) return updated
        if (linked.has(t.id) && t.amount !== per) return { ...t, amount: per }
        return t
      })
    })
  }, [])

  // Free up storage: strip receipt photos but keep the transactions
  const removeAllPhotos = useCallback(() => {
    setTransactions((prev) => prev.map((t) => (t.photo ? { ...t, photo: null } : t)))
  }, [])

  const removePhotosBefore = useCallback((dateStr) => {
    setTransactions((prev) => prev.map((t) => (t.photo && t.date < dateStr ? { ...t, photo: null } : t)))
  }, [])

  // --- Wallets ---
  const addWallet = useCallback((w) => {
    const newWallet = { id: 'w_' + uuidv4().slice(0, 8), initialBalance: 0, ...w }
    setWallets((prev) => [...prev, newWallet])
    return newWallet
  }, [])

  const updateWallet = useCallback((id, patch) => {
    setWallets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }, [])

  const deleteWallet = useCallback((id) => {
    // keep at least one wallet; transactions of a deleted wallet fall back to the default
    if (wallets.length <= 1) return
    setWallets((prev) => prev.filter((w) => w.id !== id))
    tombstone(id)
  }, [wallets.length, tombstone])

  // Transfer money between two wallets (not counted as income/expense)
  const addTransfer = useCallback(({ fromWalletId, toWalletId, amount, date, note }) => {
    setTransactions((prev) => [
      {
        id: uuidv4(),
        type: 'transfer',
        fromWalletId,
        toWalletId,
        amount,
        date,
        note: note || '',
        splitWith: [],
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
  }, [])

  // Toggle "received money back" for one person on a split bill.
  // When marked received → auto-create an income transaction; when un-marked → remove it.
  const settleSplitPerson = useCallback((txId, name) => {
    const tx = txRef.current.find((t) => t.id === txId)
    if (!tx) return
    const settlements = { ...(tx.settlements || {}) }
    const cur = settlements[name] || { received: false, incomeTxId: null }

    if (!cur.received) {
      const incomeTx = {
        id: uuidv4(),
        type: 'income',
        category: 'split_repay',
        amount: perHead(tx),
        note: `${REPAY_NOTE[billModeOf(tx)]} ${name}` + (tx.note ? ` · ${tx.note}` : ''),
        date: todayISO(),
        splitWith: [],
        createdAt: new Date().toISOString(),
        meta: { settlementOf: txId, person: name },
      }
      settlements[name] = { received: true, incomeTxId: incomeTx.id }
      setTransactions((prev) => [incomeTx, ...prev.map((t) => (t.id === txId ? { ...t, settlements } : t))])
      return
    }

    const removeId = cur.incomeTxId
    settlements[name] = { received: false, incomeTxId: null }
    setTransactions((prev) =>
      prev.filter((t) => t.id !== removeId).map((t) => (t.id === txId ? { ...t, settlements } : t))
    )
    if (removeId) tombstone(removeId)
  }, [tombstone])

  const addInstallment = useCallback((inst) => {
    const id = uuidv4()
    const start = new Date(inst.startDate)
    const y = start.getFullYear()
    const m = start.getMonth()
    const day = start.getDate()
    const payments = Array.from({ length: inst.totalMonths }, (_, i) => {
      // Clamp to the month's length — new Date(y, m, 31) would roll into the
      // next month, so a loan starting on the 31st used to skip months.
      const lastDay = new Date(y, m + i + 1, 0).getDate()
      return {
        month: i + 1,
        paid: false,
        dueDate: new Date(y, m + i, Math.min(day, lastDay), 12).toISOString(),
      }
    })
    setInstallments((prev) => [
      { ...inst, id, payments, createdAt: new Date().toISOString() },
      ...prev,
    ])
  }, [])

  // Toggle an installment payment. Marking paid → auto-records an expense in the ledger; un-marking removes it.
  const installmentsRef = useRef(installments)
  useEffect(() => { installmentsRef.current = installments }, [installments])
  const walletsRef = useRef(wallets)
  useEffect(() => { walletsRef.current = wallets }, [wallets])
  const toggleInstallmentPayment = useCallback((installmentId, monthIndex) => {
    const inst = installmentsRef.current.find((i) => i.id === installmentId)
    if (!inst) return
    const payment = inst.payments[monthIndex]
    if (!payment) return

    const setPaid = (paid, txId) =>
      setInstallments((prev) =>
        prev.map((i) =>
          i.id === installmentId
            ? { ...i, payments: i.payments.map((p, idx) => (idx === monthIndex ? { ...p, paid, txId } : p)) }
            : i
        )
      )

    if (!payment.paid) {
      // mark paid → create an expense transaction
      const expenseTx = {
        id: uuidv4(),
        type: 'expense',
        category: inst.loanType === 'credit' ? 'credit_card' : 'loan',
        amount: inst.monthlyAmount,
        note: `${inst.name} · งวด ${payment.month}`,
        date: todayISO(),
        splitWith: [],
        // pay from the wallet chosen for this debt, not always the first one
        walletId: inst.walletId || walletsRef.current[0]?.id,
        createdAt: new Date().toISOString(),
        meta: { installmentId, monthIndex },
      }
      setTransactions((prev) => [expenseTx, ...prev])
      setPaid(true, expenseTx.id)
    } else {
      // un-mark → remove the linked expense transaction
      if (payment.txId) {
        setTransactions((prev) => prev.filter((t) => t.id !== payment.txId))
        tombstone(payment.txId)
      }
      setPaid(false, null)
    }
  }, [tombstone])

  const deleteInstallment = useCallback((id) => {
    setInstallments((prev) => prev.filter((i) => i.id !== id))
    // remove any auto-created payment transactions tied to this installment
    const linked = txRef.current.filter((t) => t.meta?.installmentId === id).map((t) => t.id)
    setTransactions((prev) => prev.filter((t) => t.meta?.installmentId !== id))
    tombstone([id, ...linked])
  }, [tombstone])

  const addPerson = useCallback((name) => {
    setPeople((prev) => {
      if (prev.find((p) => p.name === name)) return prev
      return [...prev, { id: uuidv4(), name }]
    })
  }, [])

  const deletePerson = useCallback((id) => {
    setPeople((prev) => prev.filter((p) => p.id !== id))
    tombstone(id)
  }, [tombstone])

  // How many records still point at a category — used to warn before deleting it
  const countCategoryUsage = useCallback(
    (id) =>
      transactions.filter((t) => t.category === id).length +
      recurring.filter((r) => r.category === id).length,
    [transactions, recurring]
  )

  // --- Custom categories (user-created, with own emoji icon + color) ---
  const addCustomCategory = useCallback((cat) => {
    const newCat = { id: 'custom_' + uuidv4().slice(0, 8), custom: true, ...cat }
    setCustomCategories((prev) => [...prev, newCat])
    return newCat
  }, [])

  const deleteCustomCategory = useCallback((id) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== id))
    // drop its budget too, otherwise an unnamed row lingers on the dashboard
    setBudgets((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    tombstone(id)
  }, [tombstone])

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
    tombstone(id)
  }, [tombstone])

  // --- Monthly budgets per category (standing limit, applies every month) ---
  const setBudget = useCallback((categoryId, amount) => {
    setBudgets((prev) => {
      const next = { ...prev }
      if (!amount || amount <= 0) delete next[categoryId]
      else next[categoryId] = amount
      return next
    })
  }, [])

  // What the UI reads: newest first. The raw array's order is insertion order,
  // and merging cloud + local data appends rescued items at the end, so lists
  // must not rely on it.
  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (a, b) =>
          (b.date || '').localeCompare(a.date || '') ||
          (b.createdAt || '').localeCompare(a.createdAt || '')
      ),
    [transactions]
  )

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
      wallets,
      cycleStartDay,
    }),
    [transactions, installments, people, customCategories, budgets, recurring, wallets, cycleStartDay]
  )

  const importData = useCallback((data) => {
    if (!data || data.app !== 'ploy-finance' || !Array.isArray(data.transactions)) {
      throw new Error('ไฟล์สำรองไม่ถูกต้อง')
    }
    // Restoring replaces everything → tombstone whatever is here now, so the old
    // items can't come back from another device, and un-tombstone what we restore.
    const restored = new Set([
      ...(data.transactions || []),
      ...(data.installments || []),
      ...(data.people || []),
      ...(data.customCategories || []),
      ...(data.recurring || []),
      ...(data.wallets || []),
    ].map((x) => x?.id).filter(Boolean))
    const at = Date.now()
    const current = [
      ...txRef.current, ...installmentsRef.current, ...people,
      ...customCategories, ...recurring, ...wallets,
    ].map((x) => x?.id).filter((id) => id && !restored.has(id))
    setDeletedIds((prev) => pruneTombs([...prev.filter((d) => !restored.has(d.id)), ...current.map((id) => ({ id, at }))]))

    setTransactions(data.transactions || [])
    setInstallments(data.installments || [])
    setPeople(data.people || [])
    setCustomCategories(data.customCategories || [])
    setBudgets(data.budgets || {})
    setRecurring(data.recurring || [])
    setWallets(data.wallets?.length ? data.wallets : [DEFAULT_WALLET])
    setCycleStartDayState(data.cycleStartDay || 1)
  }, [people, customCategories, recurring, wallets])

  // --- Clear data (start a fresh month) ---
  // scope 'transactions' → ledger + receipt photos only (wallets, debts, settings kept)
  // scope 'all'          → everything except the app's default wallet
  const clearData = useCallback((scope = 'transactions') => {
    const at = Date.now()
    const gone = txRef.current.map((t) => t.id)

    setTransactions([])
    if (scope === 'all') {
      gone.push(
        ...installmentsRef.current.map((i) => i.id),
        ...people.map((p) => p.id),
        ...customCategories.map((c) => c.id),
        ...recurring.map((r) => r.id),
        ...wallets.filter((w) => w.id !== DEFAULT_WALLET.id).map((w) => w.id)
      )
      setInstallments([])
      setPeople([])
      setCustomCategories([])
      setRecurring([])
      setBudgets({})
      setWallets([DEFAULT_WALLET])
    } else {
      // keep the debts, but their payment ticks pointed at now-deleted transactions
      setInstallments((prev) =>
        prev.map((i) => ({ ...i, payments: i.payments.map((p) => (p.txId ? { ...p, txId: null } : p)) }))
      )
    }
    setDeletedIds((prev) => pruneTombs([...prev, ...gone.filter(Boolean).map((id) => ({ id, at }))]))
  }, [people, customCategories, recurring, wallets])

  // Per-wallet balance: initialBalance + income − expense ± transfers.
  // A transaction with no walletId — or one pointing at a wallet that has since
  // been deleted — falls back to the default wallet, so its money is never
  // dropped from the totals.
  const walletBalances = useMemo(() => {
    const defId = wallets[0]?.id
    const bal = {}
    wallets.forEach((w) => {
      bal[w.id] = Number(w.initialBalance) || 0
    })
    const resolve = (id) => (id != null && id in bal ? id : defId)
    transactions.forEach((t) => {
      if (t.type === 'transfer') {
        const from = resolve(t.fromWalletId)
        const to = resolve(t.toWalletId)
        if (from != null) bal[from] -= t.amount
        if (to != null) bal[to] += t.amount
        return
      }
      const wid = resolve(t.walletId)
      if (wid == null) return
      if (t.type === 'income') bal[wid] += t.amount
      else if (t.type === 'expense') bal[wid] -= t.amount
    })
    return bal
  }, [wallets, transactions])

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  // Money actually on hand = every wallet's balance, so "คงเหลือสะสม" can never
  // disagree with "รวมทุกกระเป๋า". (It used to be income − expense only, which
  // ignored the wallets' starting balances.)
  const balance = useMemo(
    () => wallets.reduce((s, w) => s + (walletBalances[w.id] || 0), 0),
    [wallets, walletBalances]
  )

  const monthlyInstallmentTotal = installments.reduce((sum, inst) => {
    const unpaid = inst.payments.filter((p) => !p.paid).length
    return unpaid > 0 ? sum + inst.monthlyAmount : sum
  }, 0)

  return (
    <FinanceContext.Provider
      value={{
        transactions: sortedTransactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        removeAllPhotos,
        removePhotosBefore,
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
        countCategoryUsage,
        budgets,
        setBudget,
        recurring,
        addRecurring,
        toggleRecurring,
        deleteRecurring,
        wallets,
        addWallet,
        updateWallet,
        deleteWallet,
        addTransfer,
        walletBalances,
        cycleStartDay,
        setCycleStartDay,
        expenseCats,
        incomeCats,
        getCategory,
        exportData,
        importData,
        clearData,
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
