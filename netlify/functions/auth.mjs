import crypto from 'crypto'

// Timing-safe string comparison — prevents timing attacks
function safeCompare(a, b) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function generateToken(email) {
  const secret = Netlify.env.get('OS_JWT_SECRET') || 'fallback-change-me'
  const payload = { email, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://motesart-os.netlify.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), { status: 405, headers })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid request body' }), { status: 400, headers })
  }

  const { email, password } = body

  if (!email || !password) {
    return new Response(JSON.stringify({ message: 'Email and password required' }), { status: 400, headers })
  }

  // Credentials stored in Netlify env vars — never in code
  const validEmail    = Netlify.env.get('OS_ADMIN_EMAIL') || ''
  const validPassword = Netlify.env.get('OS_ADMIN_PASSWORD') || ''

  if (!validEmail || !validPassword) {
    return new Response(JSON.stringify({ message: 'Auth not configured' }), { status: 503, headers })
  }

  const emailMatch    = safeCompare(email.toLowerCase().trim(), validEmail.toLowerCase().trim())
  const passwordMatch = safeCompare(password, validPassword)

  if (!emailMatch || !passwordMatch) {
    // Uniform delay to prevent timing attacks
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
