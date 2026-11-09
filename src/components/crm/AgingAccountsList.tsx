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
 */
export default function AgingAccountsList({
  plans,
  heading = 'Aging accounts',
  className = '',
}: {
  /** The customer's schedules, already narrowed to `isAgingAccount` ones. */
  plans: InstallmentSchedule[]
  heading?: string
  className?: string
}) {
  const accounts = plans.filter((p) => p.isAgingAccount && p.agingAccount)
  if (accounts.length === 0) return null

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
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
