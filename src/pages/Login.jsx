import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const extractUser = (data) => ({
  id: data.user?.id || data.id,
  email: data.user?.email || data.email,
  role: data.user?.role || data.role,
  name: data.user?.name || data.name || '',
})

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Register state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  const [tab, setTab] = useState('login')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const form = e.currentTarget
    const emailVal = (form.querySelector('input[type="email"]')?.value || loginEmail).trim()
    const passVal = form.querySelector('input[type="password"]')?.value || loginPassword
    try {
      const data = await api.login(emailVal, passVal)
      const token =
        data?.token ||
        data?.access_token ||
        data?.data?.token
      if (!token) {
        console.log('LOGIN RESPONSE:', data)
        setLoginError('Login failed — invalid response format')
        return
      }
      const userData =
        data?.user ||
        data?.data?.user ||
        extractUser(data) ||
        { email: emailVal }
      if (!userData) {
        console.log('USER EXTRACTION FAILED:', data)
      }
      login(userData, token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setLoginError(err?.message || 'Login failed. Check your credentials and try again.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setRegError('')
    setRegSuccess('')
    setRegLoading(true)
    try {
      await api.register(regName, regEmail, regPassword)
      setRegSuccess('Account created! You can now log in.')
      setRegName('')
      setRegEmail('')
      setRegPassword('')
      setTab('login')
      setLoginEmail(regEmail)
    } catch (err) {
      setRegError(err?.message || 'Registration failed. Please try again.')
    } finally {
      setRegLoading(false)
    }
  }

  const handleGoogle = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://deployable-python-codebase-som-production.up.railway.app'
    window.location.href = `${backendUrl}/auth/google`
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <span style={S.logoText}>School of Motesart</span>
        </div>

        <div style={S.tabs}>
          <button
            style={tab === 'login' ? { ...S.tabBtn, ...S.tabActive } : S.tabBtn}
            onClick={() => setTab('login')}
          >
            Sign In
          </button>
          <button
            style={tab === 'register' ? { ...S.tabBtn, ...S.tabActive } : S.tabBtn}
            onClick={() => setTab('register')}
          >
            Register
          </button>
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLogin} style={S.form}>
            <input
              style={S.input}
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              style={S.input}
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => { if(e.key === '-') e.stopPropagation(); }}
              autoComplete="current-password"
            />
            {loginError && <p style={S.error}>{loginError}</p>}
            <button style={S.btn} type="submit" disabled={loginLoading}>
              {loginLoading ? 'Signing inÃ¢ÂÂ¦' : 'Sign In'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} style={S.form}>
            <input
              style={S.input}
              type="text"
              placeholder="Full Name"
              value={regName}
              onChange={e => setRegName(e.target.value)}
              required
              autoComplete="name"
            />
            <input
              style={S.input}
              type="email"
              placeholder="Email"
              value={regEmail}
              onChange={e => setRegEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              style={S.input}
              type="password"
              placeholder="Password (min 8 chars)"
              value={regPassword}
              onChange={e => setRegPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
            {regError && <p style={S.error}>{regError}</p>}
            {regSuccess && <p style={S.success}>{regSuccess}</p>}
            <button style={S.btn} type="submit" disabled={regLoading}>
              {regLoading ? 'Creating accountÃ¢ÂÂ¦' : 'Create Account'}
            </button>
          </form>
        )}

        <div style={S.divider}><span>or</span></div>

        <div style={S.socialRow}>
          <button style={S.googleBtn} onClick={handleGoogle} type="button">
            Continue with Google
          </button>
        </div>

        <div style={S.footer}>
          <span>School of Motesart</span>
          <button
            style={S.wakeBtn}
            type="button"
            onClick={() => api.wake().then(() => alert('Server is awake!')).catch(() => alert('Server may be starting up...'))}
          >
            Wake up servers
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', fontFamily: "'DM Sans',sans-serif", padding: 16 },
  card: { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' },
  logo: { textAlign: 'center', marginBottom: 24 },
  logoText: { fontSize: 22, fontWeight: 800, background: 'linear-gradient(90deg,#d946ef,#a855f7,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  tabs: { display: 'flex', marginBottom: 24, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' },
  tabBtn: { flex: 1, padding: '10px 0', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" },
  tabActive: { background: 'linear-gradient(135deg,#d946ef,#a855f7)', color: '#fff' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 15, outline: 'none', fontFamily: "'DM Sans',sans-serif" },
  btn: { padding: '13px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#d946ef,#a855f7)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4, fontFamily: "'DM Sans',sans-serif" },
  error: { color: '#f87171', fontSize: 13, margin: 0, textAlign: 'center' },
  success: { color: '#4ade80', fontSize: 13, margin: 0, textAlign: 'center' },
  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 },
  socialRow: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 },
  googleBtn: { padding: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, color: 'rgba(255,255,255,0.3)', fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 },
  wakeBtn: { padding: '6px 16px', background: 'linear-gradient(135deg,#d946ef,#a855f7)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" },
}
