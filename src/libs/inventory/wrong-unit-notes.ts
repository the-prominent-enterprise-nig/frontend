// Receive-time "Wrong unit" notes on a transfer receipt. The receive form
// writes one bullet per line into the receipt notes; the transfer detail and
// its printed sheet read them back to show what actually arrived under the
// matching line. Keep the writer and reader here so the format can't drift.

const PREFIX = 'Wrong unit: expected '
const RECEIVED = ', received '

/** "Wrong unit: expected 250502400 (SHARP HMDX41PW), received 002175 (XTREME XDDFDL35)" */
export function buildWrongUnitNote(expected: string, received: string): string {
  return `${PREFIX}${expected}${RECEIVED}${received}`
}

/** Expected serial → what was received instead, from every receipt's notes. */
export function wrongUnitBySerial(
  receipts: { notes?: string | null }[] | null | undefined
): Map<string, string> {
  const map = new Map<string, string>()
  for (const receipt of receipts ?? []) {
    for (const raw of (receipt.notes ?? '').split('\n')) {
      const line = raw.replace(/^\s*•\s*/, '').trim()
      if (!line.startsWith(PREFIX)) continue
      const rest = line.slice(PREFIX.length)
      const at = rest.indexOf(RECEIVED)
      if (at < 0) continue
      const expectedSerial = rest.slice(0, at).split(' ')[0]
      map.set(expectedSerial, rest.slice(at + RECEIVED.length))
    }
  }
  return map
}

/** Whether these receipt notes flag at least one Wrong unit. */
export function hasWrongUnitNote(notes: string | null | undefined): boolean {
  return wrongUnitBySerial([{ notes }]).size > 0
}

/** Splits a received-unit label — "0925MGS-25GLS00427 (MINAMI MGS25GLS)" —
 * into its serial and the brand/model in brackets (absent when none was known). */
export function splitUnitLabel(label: string): { serial: string; model?: string } {
  const at = label.indexOf(' (')
  if (at < 0 || !label.endsWith(')')) return { serial: label }
  return { serial: label.slice(0, at), model: label.slice(at + 2, -1) }
}

/** The Wrong serial reason as the receiver typed it — always shown, even
 * when it only repeats the label (e.g. "wrong serial"); blank reads as none. */
export function serialCorrectionReason(reason: string | null | undefined): string | undefined {
  return reason?.trim() || undefined
}
