import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FinanceProvider } from './contexts/FinanceContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Installments from './pages/Installments'
import SplitBill from './pages/SplitBill'

export default function App() {
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
