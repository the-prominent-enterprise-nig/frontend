import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type { InstallmentSchedule } from '@/src/schema/pos'

/**
 * A customer's accounts loaded from the aging sheet, for the customer pages.
 *
 * They have no POS plan behind them, so the "Installment Plans" lists — which
 * are built from POS sales — never showed them, and a customer from the aging
 * read "No installment plans" with nothing else on the page. This lists them
 * apart from those plans: where the account sits, what is still owed, what
 * is due now and when the next due falls.
 *
 * Read-only on purpose. The customer page is the customer's, not a branch's
 * (the ledger shows every branch's transactions), so every branch's accounts
 * are listed; collecting stays in POS Collections, which keeps its own branch
 * rule.
 *
 * Renders nothing when the customer has none.
 *
 * Docket NIG #91 — given the customer's deposit, it also says what is waiting
 * for approval on each account and closes with Total outstanding, Less unapplied
 * deposit and Net amount due. The net is the same before and after a request is
 * approved, because the deposit it uses is everything not yet applied (a request
 * waiting for approval has reserved its part, but it has not been applied).
 */
export default function AgingAccountsList({
  plans,
  heading = 'Aging accounts',
  className = '',
  deposit,
}: {
  /** The customer's schedules, already narrowed to `isAgingAccount` ones. */
  plans: InstallmentSchedule[]
  heading?: string
  className?: string
  deposit?: {
    /** Received less applied — what the customer still has with us. */
    unapplied: number
    /** Account id → what requests waiting for approval hold on it. */
    pendingByAccount: Record<string, number>
  }
}) {
  const accounts = plans.filter((p) => p.isAgingAccount && p.agingAccount)
  if (accounts.length === 0) return null
  const totalOutstanding = accounts.reduce((t, p) => t + p.agingAccount!.outstanding, 0)

  return (
    <section
      data-testid="aging-accounts"
      className={`rounded-xl border border-zinc-200 bg-white p-5 ${className}`}
    >
      <h2 className="mb-1 text-[14px] font-semibold text-zinc-900">{heading}</h2>
      <p className="mb-3 text-[12px] text-zinc-500">
        Accounts loaded from the aging sheet. Collect on them in Point of Sale → Collections.
      </p>
      <ul className="divide-y divide-zinc-100">
        {accounts.map((p) => {
          const a = p.agingAccount!
          const pendingHere = deposit?.pendingByAccount[p.installmentAccount?.id ?? ''] ?? 0
          return (
            <li
              key={p.id}
              data-testid="aging-account-row"
              className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]"
            >
              <div className="min-w-0">
                <p className="text-zinc-800">
                  <span className="font-mono text-[12px] font-medium">{a.siNo}</span>
                  <span className="ml-2 text-zinc-500">{a.branchName ?? 'No branch'}</span>
                </p>
                <p className="mt-0.5 text-[12px] text-zinc-500">
                  {a.dueNow > 0 ? `${fmtMoney(a.dueNow)} due now` : 'Nothing due yet'} · next due{' '}
                  {fmtDate(a.nextDueDate)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium text-zinc-900">{fmtMoney(a.outstanding)}</p>
                <p className="text-[11px] text-zinc-400">outstanding</p>
                {pendingHere > 0 && (
                  <p
                    data-testid="aging-deposit-pending"
                    className="mt-0.5 text-[11px] text-amber-700"
                  >
                    Deposit {fmtMoney(pendingHere)} pending approval
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {deposit && deposit.unapplied > 0 && (
        <dl
          data-testid="aging-deposit-summary"
          className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-[13px]"
        >
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Total outstanding</dt>
            <dd className="text-zinc-900">{fmtMoney(totalOutstanding)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Less unapplied deposit</dt>
            <dd className="text-zinc-900">−{fmtMoney(deposit.unapplied)}</dd>
          </div>
          <div className="flex justify-between gap-4 font-semibold">
            <dt className="text-zinc-900">Net amount due</dt>
            <dd className="text-zinc-900">
              {fmtMoney(Math.max(0, totalOutstanding - deposit.unapplied))}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
