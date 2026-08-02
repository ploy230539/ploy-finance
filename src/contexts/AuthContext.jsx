import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { auth, googleProvider, firebaseEnabled } from '../firebase'
import { flushNow } from '../utils/flushBus'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(firebaseEnabled)

  useEffect(() => {
    if (!firebaseEnabled) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        alert('เข้าสู่ระบบไม่สำเร็จ: ' + (e?.message || e))
      }
    }
  }

  const signOut = async () => {
    // Push anything still unsynced — the local cache is about to be wiped
    await flushNow()
    await fbSignOut(auth)
    // Clear every data key so the next account starts clean.
    // (ploy_wallets / ploy_cycle_day / ploy_deleted used to be left behind,
    // which leaked one account's wallets into the next one.)
    ;[
      'ploy_transactions', 'ploy_installments', 'ploy_people', 'ploy_custom_categories',
      'ploy_budgets', 'ploy_recurring', 'ploy_wallets', 'ploy_cycle_day', 'ploy_deleted',
    ].forEach((k) => localStorage.removeItem(k))
    // Reload so no still-mounted component can write the old state back
    window.location.reload()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, enabled: firebaseEnabled }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
