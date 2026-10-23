/**
 * Scenario 67 — marks an X-Deal (barter) sale or installment account
 * wherever it is listed, so nobody mistakes it for an ordinary installment
 * sale to be collected on. The reference is the barter agreement no.
 */
export function XDealBadge({ reference }: { reference?: string | null }) {
  return (
    <span
      data-testid="x-deal-badge"
      title={reference ? `X-Deal reference: ${reference}` : 'X-Deal'}
      className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
    >
      X-DEAL
    </span>
  )
}
