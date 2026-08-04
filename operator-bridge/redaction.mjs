import { createHash } from 'node:crypto'

// Shared secret redaction for diffs, logs, and exit evidence. No secret value
// may ever reach a log line, an artifact, or an evidence report. Redaction is
// intentionally conservative: over-redaction is acceptable because the exact
// source is always preserved by its SHA-256 hash, never by storing the raw
// secret-bearing text.

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

const SECRET_KEYWORD = '(?:password|passwd|secret|token|credential|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?key|auth[_-]?token)'

// Keyworded assignments inside diff lines, quoted form:
//   +api_key = "abc123..."  /  -"token": '...'
const DIFF_ASSIGNMENT_QUOTED = new RegExp(
  `^([+-](?!--|\\+\\+).*?${SECRET_KEYWORD}\\b[^=:\\n]{0,80}[=:]\\s*)(['"])([^'"]{8,})(\\2)`,
  'i',
)
// Keyworded assignments inside diff lines, unquoted form (value at end of
// line, at least 16 non-space characters so ordinary identifiers survive):
//   +password = hunter2hunter2xx
const DIFF_ASSIGNMENT_UNQUOTED = new RegExp(
  `^([+-](?!--|\\+\\+).*?${SECRET_KEYWORD}\\b[^=:\\n]{0,80}[=:]\\s*)([^\\s'"]{16,})\\s*$`,
  'i',
)

// Free-form high-entropy credential shapes. These are applied to whole text
// (multi-line blocks first, then line content) and to evidence string values.
export const SECRET_VALUE_PATTERNS = Object.freeze([
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bnpm_[A-Za-z0-9]{30,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
])

const MULTILINE_PATTERNS = SECRET_VALUE_PATTERNS.filter((pattern) => pattern.source.includes('[\\s\\S]'))
const INLINE_PATTERNS = SECRET_VALUE_PATTERNS.filter((pattern) => !pattern.source.includes('[\\s\\S]'))

export const REDACTED_PLACEHOLDER = '[REDACTED_POTENTIAL_SECRET]'

function applyPatterns(text, patterns, state) {
  let next = text
  for (const pattern of patterns) {
    next = next.replace(pattern, () => {
      state.count += 1
      return REDACTED_PLACEHOLDER
    })
  }
  return next
}

export function sanitizeUnifiedDiff(diff) {
  const state = { count: 0 }
  const blocked = applyPatterns(diff, MULTILINE_PATTERNS, state)
  const sanitized = blocked.split(/\r?\n/).map((line) => {
    let next = line
    if (DIFF_ASSIGNMENT_QUOTED.test(next)) {
      next = next.replace(DIFF_ASSIGNMENT_QUOTED, `$1$2${REDACTED_PLACEHOLDER}$4`)
      state.count += 1
    } else if (DIFF_ASSIGNMENT_UNQUOTED.test(next)) {
      next = next.replace(DIFF_ASSIGNMENT_UNQUOTED, `$1${REDACTED_PLACEHOLDER}`)
      state.count += 1
    }
    return applyPatterns(next, INLINE_PATTERNS, state)
  }).join('\n')
  return { sanitized, redactionCount: state.count, sourceSha256: sha256(diff) }
}

// Key names whose values are always scrubbed from structured evidence, logs,
// and error metadata before persistence. Matching is case-insensitive and
// covers camelCase and snake_case forms.
const SENSITIVE_KEY_PATTERN = /(token|secret|password|passwd|credential|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?key|authorization|cookie|session[_-]?key)/i

export const REDACTED_FIELD = '[REDACTED]'

// Recursively clone a JSON-compatible value, replacing the value of every
// sensitive-named field and pattern-scrubbing every string. Used for exit
// evidence, timeline records, and any structured log payload so that lease
// tokens, session tokens, bootstrap tokens, and API keys never persist.
export function redactEvidenceValue(value) {
  const state = { count: 0 }
  const scrubbed = scrubValue(value, state, null)
  return { value: scrubbed, redactionCount: state.count }
}

function scrubValue(value, state, key) {
  if (typeof key === 'string' && SENSITIVE_KEY_PATTERN.test(key)) {
    if (value === null || value === undefined) return value
    state.count += 1
    return REDACTED_FIELD
  }
  if (Array.isArray(value)) return value.map((entry) => scrubValue(entry, state, null))
  if (value && typeof value === 'object') {
    const clone = {}
    for (const [entryKey, entryValue] of Object.entries(value)) {
      clone[entryKey] = scrubValue(entryValue, state, entryKey)
    }
    return clone
  }
  if (typeof value === 'string') return applyPatterns(value, SECRET_VALUE_PATTERNS, state)
  return value
}
