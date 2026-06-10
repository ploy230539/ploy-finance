import { useEffect } from 'react'

// Full-screen lightbox for viewing a receipt/slip image.
export default function ReceiptViewer({ src, onClose }) {
  useEffect(() => {
    if (!src) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [src])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/85 flex items-center justify-center p-4 fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white text-2xl flex items-center justify-center"
        aria-label="ปิด"
      >
        ×
      </button>
      <img
        src={src}
        alt="สลิป/ใบเสร็จ"
        className="max-w-full max-h-[88vh] object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
