import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isInAppBrowser, isAndroid } from '../utils/browser'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const inApp = isInAppBrowser()
  const [copied, setCopied] = useState(false)

  function copyLink() {
    const url = window.location.href
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      },
      () => {}
    )
  }

  function openExternal() {
    const url = window.location.href
    // Android: try to force-open in Chrome via intent URL
    if (isAndroid()) {
      const noScheme = url.replace(/^https?:\/\//, '')
      window.location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`
    } else {
      // iOS: opening externally from a webview isn't reliable — copy link instead
      copyLink()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary-100 to-primary-300">
      <div className="bg-white rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-8 max-w-sm w-full text-center">
        <div className="text-6xl mb-3">💰</div>
        <h1 className="text-2xl font-bold text-primary-800 mb-1">เงินทองของฉันหายไปไหน</h1>
        <p className="text-sm text-slate-400 mb-6">จัดการรายรับรายจ่าย · ซิงค์ทุกอุปกรณ์</p>

        {inApp ? (
          <div className="text-left">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="font-semibold text-amber-800 text-sm mb-1">⚠️ กรุณาเปิดในเบราว์เซอร์</div>
              <p className="text-xs text-amber-700 leading-relaxed">
                การเข้าสู่ระบบด้วย Google ใช้ไม่ได้ในแอป Messenger/Facebook
                ให้เปิดลิงก์นี้ใน <b>Chrome</b> หรือ <b>Safari</b> ก่อน
              </p>
            </div>
            <ol className="text-xs text-slate-500 space-y-1.5 mb-4 list-decimal list-inside">
              <li>แตะปุ่ม <b>⋯</b> หรือ <b>⋮</b> มุมขวาบน</li>
              <li>เลือก <b>“เปิดในเบราว์เซอร์”</b> (Open in Chrome / Safari)</li>
            </ol>
            <div className="flex gap-2">
              <button onClick={openExternal} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold bg-gradient-to-br from-primary-600 to-primary-700">
                เปิดในเบราว์เซอร์
              </button>
              <button onClick={copyLink} className="px-4 py-3 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600">
                {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              เข้าสู่ระบบด้วย Google
            </button>
            <p className="text-xs text-slate-400 mt-6 leading-relaxed">
              ข้อมูลของคุณจะถูกเก็บอย่างปลอดภัยและซิงค์ข้ามเครื่องอัตโนมัติ
            </p>
          </>
        )}
      </div>
    </div>
  )
}
