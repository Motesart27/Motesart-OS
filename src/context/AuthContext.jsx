import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('som_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const [verifying, setVerifying] = useState(false)

  // ── Persist to localStorage (but NEVER trust it as source of truth) ──
  useEffect(() => {
    if (user) localStorage.setItem('som_user', JSON.stringify(user))
    else localStorage.removeItem('som_user')
  }, [user])

  // ── Login: set user from backend response only ──
  const login = (userData, token) => {
    // SECURITY: Role comes from backend (Airtable) only.
    // Default to "student" if backend somehow omits role.
    const u = { ...userData, role: userData.role || 'student' }
    setUser(u)
    // Store JWT token
    if (token) localStorage.setItem('som_token', token)
  }

  // ── Logout: clear everything ──
  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('som_user')
    localStorage.removeItem('som_token')
  }, [])

  // ── Update user fields (NEVER allow role mutation from frontend) ──
  const updateUser = (updates) => {
    // SECURITY: Strip role from any frontend update attempt.
    // Role can ONLY change via Airtable → re-login.
    const { role, ...safeUpdates } = updates
    setUser(prev => prev ? { ...prev, ...safeUpdates } : null)
  }

  // ── Listen for force-logout from API 401 responses ──
  useEffect(() => {
    const handler = () => {
      console.warn('[SOM Auth] Force-logout: token rejected by backend')
      logout()
    }
    window.addEventListener('som:force-logout', handler)
    return () => window.removeEventListener('som:force-logout', handler)
  }, [logout])

  // ── Verify user still exists in Airtable on app boot ──
  // Prevents legacy/ghost users from persisting via stale localStorage
  useEffect(() => {
    if (!user || !user.email) return

    const token = localStorage.getItem('som_token')
    if (!token) {
      // No token = legacy session. Force re-login.
      console.warn('[SOM Auth] No token found — clearing legacy session')
      console.warn('Session expired. Please log in again.')
      logout()
      return
    }

    let cancelled = false
    setVerifying(true)

    api.verifySession()
      .then(data => {
        if (cancelled) return
        if (!data || !data.valid) {
          console.warn('[SOM Auth] Session invalid — forcing re-login')
          console.warn('Session expired. Please log in again.')
          logout()
        } else if (data.user) {
          // Refresh role from Airtable (in case admin changed it)
          setUser(prev => prev ? { ...prev, role: data.user.role || 'student' } : null)
        }
      })
      .catch(() => {
        // Backend unreachable — do NOT grant access. Force re-login.
        if (!cancelled) {
          console.warn('[SOM Auth] Backend unreachable — clearing session')
          console.warn('Session expired. Please log in again.')
          logout()
        }
      })
      .finally(() => { if (!cancelled) setVerifying(false) })

    return () => { cancelled = true }
  }, []) // Only on mount

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, verifying }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
