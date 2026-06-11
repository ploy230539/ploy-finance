import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { auth, googleProvider, firebaseEnabled } from '../firebase'

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
    await fbSignOut(auth)
    // clear local cache so the next account doesn't briefly see this account's data
    ;['ploy_transactions', 'ploy_installments', 'ploy_people', 'ploy_custom_categories', 'ploy_budgets', 'ploy_recurring'].forEach(
      (k) => localStorage.removeItem(k)
    )
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
