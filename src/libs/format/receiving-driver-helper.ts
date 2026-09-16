/**
 * The delivery crew on a receiving report's "Driver/Helper" line.
 *
 * One shared formatter for the same reason the discount chain has one: the
 * on-screen sheet and the printed document are meant to be the same paper, and
 * two hand-rolled versions is how one ends up reading "Juan / Pedro" and the
 * other "Juan, Pedro".
 *
 * Either name can be absent — a delivery often arrives with a driver and no
 * helper, and receipts created before these fields existed have neither.
 * Returns null when nothing was recorded, so callers render their own
 * placeholder rather than this inventing one.
 */
export function receivingReportDriverHelper(receipt: {
  driverName?: string | null
  helperName?: string | null
}): string | null {
  const names = [receipt.driverName, receipt.helperName]
    .map((n) => n?.trim())
    .filter((n): n is string => !!n)
  return names.length > 0 ? names.join(' / ') : null
}
