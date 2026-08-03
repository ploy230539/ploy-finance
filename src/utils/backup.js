// Backup / restore + CSV export helpers (no external dependencies)

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// --- "when did I last back up?" (per device — the file lands on this device) ---
const LAST_KEY = 'ploy_last_backup'
const SNOOZE_KEY = 'ploy_backup_snooze'
const DAY = 86400000

export const REMIND_AFTER_DAYS = 30
const SNOOZE_DAYS = 7

function readDate(key) {
  const v = localStorage.getItem(key)
  const ms = v ? Date.parse(v) : NaN
  return Number.isNaN(ms) ? null : ms
}

export function lastBackupAt() {
  return readDate(LAST_KEY)
}

export function daysSinceBackup() {
  const at = lastBackupAt()
  return at === null ? null : Math.floor((Date.now() - at) / DAY)
}

export function snoozeReminder() {
  localStorage.setItem(SNOOZE_KEY, new Date().toISOString())
}

// Nag only when there is something worth losing, and never more than weekly.
export function shouldRemindBackup(recordCount) {
  if (recordCount < 10) return false
  const snoozed = readDate(SNOOZE_KEY)
  if (snoozed !== null && Date.now() - snoozed < SNOOZE_DAYS * DAY) return false
  const days = daysSinceBackup()
  return days === null || days >= REMIND_AFTER_DAYS
}

// Full JSON backup (re-importable)
export function downloadBackup(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `ploy-finance-backup-${today()}.json`)
  localStorage.setItem(LAST_KEY, new Date().toISOString())
  localStorage.removeItem(SNOOZE_KEY)
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function rowsToCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')]
  rows.forEach((r) => lines.push(r.map(csvCell).join(',')))
  // UTF-8 BOM so Excel renders Thai correctly
  return '﻿' + lines.join('\r\n')
}

// Excel-viewable CSV of transactions
export function downloadTransactionsCsv(transactions, getCategory) {
  const headers = ['วันที่', 'ประเภท', 'หมวดหมู่', 'จำนวนเงิน', 'หมายเหตุ', 'หารกับ', 'มีสลิป']
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date))
  const rows = sorted.map((t) => [
    t.date,
    t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
    getCategory(t.category)?.name || t.category,
    t.amount,
    t.note || '',
    (t.splitWith || []).join(' / '),
    t.photo ? 'มี' : '',
  ])
  triggerDownload(new Blob([rowsToCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), `ploy-finance-รายการ-${today()}.csv`)
}

// Read a JSON backup file → object
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result))
      } catch {
        reject(new Error('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง'))
      }
    }
    reader.readAsText(file)
  })
}
