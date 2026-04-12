import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/os', { replace: true })
  }, [user, navigate])

  const [email, setEmail]       = useState('motesarttech@gmail.com')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email.trim(), password)
      const token = data?.token || data?.access_token || data?.data?.token
      if (!token) { setError('Login failed — no token returned'); return }
      const userData = data?.user || { email: email.trim(), name: 'Denarius Motes', role: 'admin' }
      login(userData, token)
      navigate('/os', { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.bg} />
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoBox}>M</div>
          <div>
            <div style={S.logoName}>Motesart OS</div>
            <div style={S.logoTag}>Executive Command Center</div>
          </div>
        </div>
        <div style={S.rule} />
        <form onSubmit={handleLogin} style={S.form}>
          <input
            style={S.input}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onFocus={e => e.target.style.borderColor='rgba(201,168,76,0.6)'}
            onBlur={e  => e.target.style.borderColor='rgba(255,255,255,0.08)'}
            required
            autoComplete="email"
          />
          <input
            style={S.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={e => e.target.style.borderColor='rgba(201,168,76,0.6)'}
            onBlur={e  => e.target.style.borderColor='rgba(255,255,255,0.08)'}
            required
            autoComplete="current-password"
            autoFocus
          />
          {error && <div style={S.error}>{error}</div>}
          <button style={{...S.btn, opacity: loading ? 0.6 : 1}} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div style={S.footer}>
          <span style={S.footerText}>Motesart Tech — Private</span>
          <button style={S.wakeBtn} type="button"
            onClick={() => api.wake()
              .then(() => setError(''))
              .catch(() => setError('Server starting — try again in 30s'))}>
            Wake servers
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  page:     { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#070709', fontFamily:"'DM Sans',system-ui,sans-serif", padding:16, position:'relative', overflow:'hidden' },
  bg:       { position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(201,168,76,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.03) 1px,transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none' },
  card:     { position:'relative', background:'#0c0c10', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'36px 32px', width:'100%', maxWidth:380, boxShadow:'0 24px 64px rgba(0,0,0,0.7)' },
  logo:     { display:'flex', alignItems:'center', gap:14, marginBottom:22 },
  logoBox:  { width:44, height:44, borderRadius:10, background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.28)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#c9a84c', flexShrink:0 },
  logoName: { fontSize:20, fontWeight:800, color:'#f0ede8', letterSpacing:'-0.02em' },
  logoTag:  { fontSize:10, color:'#52525e', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:2 },
  rule:     { height:'0.5px', background:'rgba(255,255,255,0.07)', marginBottom:22 },
  form:     { display:'flex', flexDirection:'column', gap:10 },
  input:    { padding:'12px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'#111116', color:'#f0ede8', fontSize:14, outline:'none', fontFamily:'inherit', transition:'border-color 0.15s' },
  btn:      { padding:'13px 0', borderRadius:8, border:'1px solid rgba(201,168,76,0.28)', background:'rgba(201,168,76,0.1)', color:'#c9a84c', fontSize:14, fontWeight:700, cursor:'pointer', marginTop:4, fontFamily:'inherit', letterSpacing:'0.03em', transition:'all 0.15s' },
  error:    { background:'rgba(201,90,90,0.1)', border:'1px solid rgba(201,90,90,0.2)', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#c95a5a', textAlign:'center' },
  footer:   { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:22, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' },
  footerText:{ fontSize:10, color:'#52525e', letterSpacing:'0.06em' },
  wakeBtn:  { padding:'4px 10px', background:'rgba(201,168,76,0.08)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:5, color:'#c9a84c', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
}
