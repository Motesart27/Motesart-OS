import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

function encoded(value) {
  return Buffer.from(value).toString('base64url')
}

function decoded(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createPasswordHash(password, salt = randomBytes(16).toString('hex')) {
  const derived = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  return `scrypt$16384$8$1$${salt}$${derived.toString('hex')}`
}

export function verifyPassword(password, encodedHash) {
  const [algorithm, n, r, p, salt, expected] = String(encodedHash).split('$')
  if (algorithm !== 'scrypt' || !salt || !expected) return false
  try {
    const actual = scryptSync(password, salt, expected.length / 2, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    }).toString('hex')
    return constantTimeEqual(actual, expected)
  } catch {
    return false
  }
}

export function signToken(payload, key, { issuer, audience, ttlSeconds }) {
  const now = Math.floor(Date.now() / 1000)
  const header = encoded(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = encoded(JSON.stringify({
    ...payload,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + ttlSeconds,
    jti: randomUUID(),
  }))
  const signature = createHmac('sha256', key).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

export function verifyToken(token, key, { issuer, audience, allowedRoles }) {
  const [headerPart, payloadPart, signature] = String(token ?? '').split('.')
  if (!headerPart || !payloadPart || !signature) throw new Error('INVALID_TOKEN')
  const expected = createHmac('sha256', key).update(`${headerPart}.${payloadPart}`).digest('base64url')
  if (!constantTimeEqual(signature, expected)) throw new Error('INVALID_TOKEN')
  let header
  let payload
  try {
    header = JSON.parse(decoded(headerPart))
    payload = JSON.parse(decoded(payloadPart))
  } catch {
    throw new Error('INVALID_TOKEN')
  }
  const now = Math.floor(Date.now() / 1000)
  if (header.alg !== 'HS256' || payload.iss !== issuer || payload.aud !== audience || !Number.isInteger(payload.exp)) {
    throw new Error('INVALID_TOKEN')
  }
  if (payload.exp <= now) throw new Error('EXPIRED_TOKEN')
  if (!allowedRoles.includes(payload.role)) throw new Error('FORBIDDEN_ROLE')
  return payload
}
