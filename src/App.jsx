/**
 * Motesart OS — App.jsx
 * Executive dashboard only. All SOM routes moved to school-of-motesart repo.
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import MotesartOS from './pages/MotesartOS.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  const role = (user.role || '').toLowerCase()
  if (role !== 'admin') return <Navigate to="/" replace />
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/os" element={<AdminRoute><MotesartOS /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
