import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { FinanceProvider } from './contexts/FinanceContext'
import Layout from './components/Layout'
import LoginScreen from './components/LoginScreen'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Installments from './pages/Installments'
import SplitBill from './pages/SplitBill'

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

function Gate() {
  const { enabled, loading, user } = useAuth()

  // Firebase configured but auth state still resolving
  if (enabled && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-4xl animate-pulse">💰</div>
      </div>
    )
  }

  // Firebase configured but not signed in → show login
  if (enabled && !user) return <LoginScreen />

  // Signed in, or Firebase disabled (localStorage-only mode)
  return (
    <FinanceProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/installments" element={<Installments />} />
            <Route path="/split" element={<SplitBill />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FinanceProvider>
  )
}
