import type { BanknoteCounts } from '@/types/cashDrawer.dto'

/** Vietnamese banknotes the drawer counts, largest first (same list as the backend). */
export const BANKNOTES = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000] as const

/** Sum of a banknote count in VND. */
export const notesTotal = (notes: BanknoteCounts) =>
  Object.entries(notes).reduce((sum, [value, count]) => sum + Number(value) * count, 0)

/** Notes with a count above zero only (what the API stores). */
export const cleanNotes = (notes: BanknoteCounts): BanknoteCounts =>
  Object.fromEntries(Object.entries(notes).filter(([, count]) => count > 0)) as BanknoteCounts

/**
 * Change for `amount` from the notes available, largest notes first, never using a note the drawer does not have.
 * Returns null when the drawer cannot make that change exactly.
 */
export function suggestChange(amount: number, available: BanknoteCounts): BanknoteCounts | null {
  if (amount <= 0) return {}
  const change: BanknoteCounts = {}
  let left = amount
  for (const value of BANKNOTES) {
    const usable = Math.min(Math.floor(left / value), Math.max(0, available[value] ?? 0))
    if (usable > 0) {
      change[value] = usable
      left -= usable * value
    }
  }
  return left === 0 ? change : null
}

/** "2 × 50,000 + 1 × 10,000" */
export const describeNotes = (notes: BanknoteCounts) =>
  BANKNOTES.filter((v) => (notes[v] ?? 0) > 0)
    .map((v) => `${notes[v]} × ${v.toLocaleString('en-US')}`)
    .join(' + ')
