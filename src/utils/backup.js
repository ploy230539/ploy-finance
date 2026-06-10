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
  return new Date().toISOString().split('T')[0]
}

// Full JSON backup (re-importable)
export function downloadBackup(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `ploy-finance-backup-${today()}.json`)
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
