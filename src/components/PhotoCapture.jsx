import { useRef, useState } from 'react'
import { compressImage } from '../utils/image'
import { useLang } from '../contexts/LanguageContext'

// Capture or pick a receipt/slip photo, compress it, return a data URL via onChange.
export default function PhotoCapture({ value, onChange, accent = '#D97706' }) {
  const { t } = useLang()
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      onChange(await compressImage(file))
    } catch {
      alert('ไม่สามารถอ่านรูปได้ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {value ? (
        <div className="relative">
          <img src={value} alt="สลิป" className="w-full max-h-60 object-contain rounded-xl border border-slate-200 bg-slate-50" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-lg"
            aria-label="ลบรูป"
          >
            ×
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full"
          >
            {t('เปลี่ยนรูป')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="w-full border-2 border-dashed border-slate-200 rounded-xl py-7 text-center text-slate-400 transition-colors hover:bg-slate-50"
          style={{ borderColor: loading ? accent : undefined }}
        >
          {loading ? (
            <span className="text-sm" style={{ color: accent }}>{t('⏳ กำลังบีบอัดรูป...')}</span>
          ) : (
            <span className="flex flex-col items-center gap-1">
              <span className="text-3xl">📷</span>
              <span className="text-sm">{t('แตะเพื่อถ่าย / เลือกรูปสลิป')}</span>
            </span>
          )}
        </button>
      )}
    </div>
  )
}
