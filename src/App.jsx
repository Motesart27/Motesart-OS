/**
 * Motesart OS — App.jsx
 * Executive dashboard — Denarius Motes private access only.
 * Completely separate from School of Motesart.
 */
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import MotesartOS from './pages/MotesartOS.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const V2App = lazy(() => import('./v2/V2App.jsx'))
const MOS_V2 = import.meta.env.VITE_MOS_V2 === 'true' || window.MOS_V2 === true

function PrivateRoute({ children }) {
  const { user, verifying } = useAuth()
  if (verifying) return null
  if (!user) return <Navigate to="/login" replace />
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export default function App() {
  return (
    <Routes>
      <Route path="/"      element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/os"    element={<PrivateRoute><MotesartOS /></PrivateRoute>} />
      {MOS_V2 && <Route path="/v2/*" element={<PrivateRoute><Suspense fallback={null}><V2App /></Suspense></PrivateRoute>} />}
      <Route path="*"      element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
