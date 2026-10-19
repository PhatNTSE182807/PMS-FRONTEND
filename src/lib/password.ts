const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '@#$%&*!?'
const ALL = LOWER + UPPER + DIGITS + SYMBOLS

function randomIndex(max: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint32Array(1)
    crypto.getRandomValues(buffer)
    return buffer[0] % max
  }
  return Math.floor(Math.random() * max)
}

/**
 * Random password with at least one lower-case letter, upper-case letter, digit and symbol.
 * Look-alike characters (0/O, 1/l/I) are excluded so it can be read out over the phone.
 */
export function generatePassword(length = 12): string {
  const chars = [LOWER, UPPER, DIGITS, SYMBOLS].map((set) => set[randomIndex(set.length)])
  while (chars.length < length) chars.push(ALL[randomIndex(ALL.length)])

  // Fisher-Yates shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Password rule shared with the backend (UserValidatorConfiguration): 6+ characters, one upper case letter, one special character. */
export const PASSWORD_MIN_LENGTH = 6

export const PASSWORD_RULE_MESSAGE = 'Password must be at least 6 characters with an upper-case letter and a special character.'

/** The same rule worded as advice, for the hint above password forms. Keep it in sync with PASSWORD_RULE_MESSAGE. */
export const PASSWORD_RULE_HINT = `Protect your account with a strong password: at least ${PASSWORD_MIN_LENGTH} characters with an upper-case letter and a special character.`

/**
 * Each part of the rule on its own, so forms can tick them off as the user types. Mirrors the
 * backend regex ^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$ plus the minimum length.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (p: string) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper', label: 'One upper-case letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'symbol', label: 'One special character (e.g. @ # ! ?)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const

/** True when the password passes every rule the API checks. */
export function isValidPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}
