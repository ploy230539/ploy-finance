// Detect in-app browsers (Messenger, Facebook, Instagram, Line, etc.)
// Google OAuth (sign-in) is blocked inside these embedded webviews.
export function isInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || ''
  return /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|LINE\/|MicroMessenger|TikTok|Twitter/i.test(ua)
}

export function isAndroid() {
  return /Android/i.test(navigator.userAgent || '')
}
