/**
 * Scenario 77 — a payment option's short name as the bank's full legal name.
 *
 * Client note (Oct 16): "Replace 'MTCB' with Metrobank's full name and display
 * the full names of other banks as well." The short names are the payment
 * options seeded from the client's own lists, and they stay stored as they
 * are: the QR list is split into its checkout groups by name, and every
 * closed session's tender breakdown carries the name inside its keys
 * ('card::MBTC'). So the full name is applied only where a name is shown,
 * which also renames the lines of sessions closed before this shipped.
 *
 * The branch after each bank is the client's own deposit account: BDO-Q is
 * BDO Iloilo Quezon, LB-PSB is Landbank Passi. Maya, GCash, the billers and
 * Check are brands, not bank abbreviations, and stay as they are.
 *
 * Mirrors the backend's src/pos/bank-names.ts; change one, change the other.
 */

const METROBANK = 'Metropolitan Bank and Trust Company'
const BDO = 'BDO Unibank'
const BPI = 'Bank of the Philippine Islands'
const LANDBANK = 'Land Bank of the Philippines'

/** Keyed by the short name, upper-cased. */
const BANK_FULL_NAMES: Record<string, string> = {
  MBTC: METROBANK,
  METROBANK: METROBANK,
  BDO: BDO,
  'BDO-Q': `${BDO} — Iloilo Quezon`,
  'BDO-GF': `${BDO} — Goldenfield`,
  BPI: BPI,
  'BPI-ARANETA': `${BPI} — Araneta`,
  'BPI-CENTRAL': `${BPI} — Iloilo Central Market`,
  'LB-PSB': `${LANDBANK} — Passi`,
  'LB-SIPALAY': `${LANDBANK} — Sipalay`,
  'LB-SAGAY': `${LANDBANK} — Sagay`,
  SBANK: 'Security Bank Corporation',
}

/** The name to show for a payment option: the bank's full name when the
 *  short name is one of the client's banks, otherwise the name as stored. */
export function bankDisplayName(name: string): string
export function bankDisplayName(name: string | null | undefined): string | null | undefined
export function bankDisplayName(name: string | null | undefined): string | null | undefined {
  if (!name) return name
  return BANK_FULL_NAMES[name.trim().toUpperCase()] ?? name
}

/** A picker option for a payment option: shown by its full name, still
 *  found by typing the short one ("MBTC", "BDO-Q") the cashier knows. */
export function bankPickerOption(o: { id: string; name: string }): {
  value: string
  label: string
  keywords: string
} {
  return { value: o.id, label: bankDisplayName(o.name), keywords: o.name }
}
