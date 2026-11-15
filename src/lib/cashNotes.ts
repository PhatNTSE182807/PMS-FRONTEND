/**
 * Vietnamese banknotes, largest first. Banknotes are no longer counted in the drawer (2026-11-15): the values only
 * drive the quick-add buttons that build up an amount at the POS and in the cash request.
 */
export const BANKNOTES = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000] as const
