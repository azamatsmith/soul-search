export type DisplayNameError = 'too_short' | 'too_long' | 'invalid'

export type DisplayNameResult =
  { ok: true; name: string } | { ok: false; error: DisplayNameError }

const MIN_LENGTH = 2
const MAX_LENGTH = 20
const ALLOWED = /^[A-Za-z0-9 .'-]+$/

export const validateDisplayName = (raw: string): DisplayNameResult => {
  const name = raw.trim()
  if (name.length < MIN_LENGTH) return { ok: false, error: 'too_short' }
  if (name.length > MAX_LENGTH) return { ok: false, error: 'too_long' }
  if (!ALLOWED.test(name)) return { ok: false, error: 'invalid' }
  return { ok: true, name }
}
