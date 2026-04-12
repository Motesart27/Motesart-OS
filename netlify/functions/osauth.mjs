import crypto from 'crypto'

const EMAIL    = 'motesarttech@gmail.com'
const PASSWORD = 'Blessedall2026'

function token(email) {
  const payload = Buffer.from(JSON.stringify({ email, role: 'admin', exp: Date.now() + 604800000 })).toString('base64url')
  const sig = crypto.createHmac('sha256', 'motesart-os-2026').update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const { email = '', password = '' } = await req.json().catch(() => ({}))
  const ok = email.toLowerCase().trim() === EMAIL && password === PASSWORD
  if (!ok) {
    await new Promise(r => setTimeout(r, 300))
    return new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  return new Response(JSON.stringify({ token: token(email), user: { email, name: 'Denarius Motes', role: 'admin' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export const config = { path: '/api/login' }
