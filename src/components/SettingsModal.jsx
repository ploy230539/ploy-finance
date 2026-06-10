import { useRef, useState } from 'react'
import { useFinance } from '../contexts/FinanceContext'
import Modal from './Modal'
import { downloadBackup, downloadTransactionsCsv, readBackupFile } from '../utils/backup'

export default function SettingsModal({ isOpen, onClose }) {
  const { exportData, importData, getCategory, transactions } = useFinance()
  const fileRef = useRef(null)
  const [msg, setMsg] = useState(null)

  function flash(text, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  function handleBackup() {
    downloadBackup(exportData())
    flash('ดาวน์โหลดไฟล์สำรองแล้ว — เก็บไว้ที่ปลอดภัยนะ')
  }

  function handleCsv() {
    if (transactions.length === 0) return flash('ยังไม่มีรายการให้ส่งออก', false)
    downloadTransactionsCsv(transactions, getCategory)
    flash('ส่งออก CSV แล้ว (เปิดด้วย Excel ได้)')
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = await readBackupFile(file)
      const count = data.transactions?.length ?? 0
      if (!confirm(`กู้คืนข้อมูลจากไฟล์นี้? (${count} รายการ)\n\n⚠️ ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่`)) return
      importData(data)
      flash('กู้คืนข้อมูลสำเร็จ ✓')
    } catch (err) {
      flash(err.message || 'กู้คืนไม่สำเร็จ', false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ตั้งค่า & ข้อมูล">
      <div className="space-y-5">
        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-income-light text-income' : 'bg-expense-light text-expense'}`}>
            {msg.text}
          </div>
        )}

        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">💾 สำรองข้อมูล</h3>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            ข้อมูลเก็บในเครื่องนี้เท่านั้น — ควรสำรองเป็นระยะ ถ้าล้างเบราว์เซอร์หรือเปลี่ยนเครื่อง จะได้กู้คืนได้
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleBackup}
              className="py-3 rounded-xl text-white text-sm font-semibold bg-gradient-to-br from-primary-600 to-primary-700 active:translate-y-px"
            >
              ⬇️ สำรอง (JSON)
            </button>
            <button
              onClick={handleCsv}
              className="py-3 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600 active:translate-y-px"
            >
              📊 ส่งออก Excel
            </button>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">♻️ กู้คืนข้อมูล</h3>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            เลือกไฟล์สำรอง (.json) ที่เคยดาวน์โหลดไว้ — ข้อมูลปัจจุบันจะถูกแทนที่
          </p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-primary-300 text-primary-700 active:translate-y-px"
          >
            ⬆️ เลือกไฟล์สำรองเพื่อกู้คืน
          </button>
        </section>
      </div>
    </Modal>
  )
}
