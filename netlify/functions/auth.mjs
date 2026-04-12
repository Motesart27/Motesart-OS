import crypto from 'crypto'

function safeCompare(a, b) {
  try {
    const bufA = Buffer.from(String(a))
    const bufB = Buffer.from(String(b))
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch { return false }
}

function generateToken(email) {
  const secret = Netlify.env.get('OS_JWT_SECRET') || 'motesart-os-secret-2026'
  const payload = { email, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

// Credentials — email from env var, password hardcoded for now
const ADMIN_EMAIL    = 'motesarttech@gmail.com'
const ADMIN_PASSWORD = 'Blessedall2026'

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), { status: 405, headers })
  }

  let body
  try { body = await req.json() }
  catch { return new Response(JSON.stringify({ message: 'Invalid body' }), { status: 400, headers }) }

  const { email, password } = body || {}

  if (!email || !password) {
    return new Response(JSON.stringify({ message: 'Email and password required' }), { status: 400, headers })
  }

  // Check env vars first, fall back to hardcoded
  const validEmail    = Netlify.env.get('OS_ADMIN_EMAIL')    || ADMIN_EMAIL
  const validPassword = Netlify.env.get('OS_ADMIN_PASSWORD') || ADMIN_PASSWORD

  const emailMatch    = safeCompare(email.toLowerCase().trim(), validEmail.toLowerCase().trim())
  const passwordMatch = safeCompare(password, validPassword)

  if (!emailMatch || !passwordMatch) {
    await new Promise(r => setTimeout(r, 300))
    return new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401, headers })
  }

  const token = generateToken(email)
  const user  = { email, name: 'Denarius Motes', role: 'admin' }

  return new Response(JSON.stringify({ token, user }), { status: 200, headers })
}

export const config = {
  path: '/api/login',
}
