'use client'

import { useMemo, useState } from 'react'
import {
  CustomerDeposits,
  fmtDate,
  fmtMoney,
  type CustomerDepositSummary,
  type DepositApplicationRow,
  type DepositApplicationStatus,
} from '@/src/libs/data/AccountingV2Data'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import type { InstallmentSchedule } from '@/src/schema/pos'

/** What the server says when a request is turned down, in words. */
export function humanizeDepositError(error: string | undefined): string {
  const code = (error ?? '').split(':')[0].trim()
  switch (code) {
    case 'amount_exceeds_available_deposit':
      return 'That is more than the deposit that is still available.'
    case 'amount_exceeds_account_outstanding':
      return 'That is more than the account still owes.'
    case 'aging_account_not_found':
      return 'That account is not open for this customer any more.'
    case 'application_not_pending':
      return 'That request has already been decided.'
    case 'rejection_reason_required':
      return 'Say why it is rejected.'
    default:
      return error || 'Something went wrong. Try again.'
  }
}

const STATUS_LABEL: Record<DepositApplicationStatus, string> = {
  PENDING: 'Pending approval',
  APPROVED: 'Applied',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

export const STATUS_CLASS: Record<DepositApplicationStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  CANCELLED: 'bg-gray-100 text-gray-600 ring-gray-200',
}

export function DepositStatusChip({ status }: { status: DepositApplicationStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * The CRM profile's Deposits card (Docket NIG #91): what the customer has paid
 * ahead of any bill, still unapplied, each deposit, and — for Head Office AR —
 * the way to apply it to one aging account for an Approver's approval.
 *
 * Everyone who can open the profile sees the deposits; only a role holding the
 * apply permission gets the Apply deposit button. A request reserves its
 * amount (it comes off what can still be applied) but moves nothing until it
 * is approved, so the account's own balance stays where it is meanwhile.
 */
export default function CustomerDepositsCard({
  customerId,
  summary,
  agingAccounts,
  canApply,
  onChanged,
}: {
  customerId: string
  summary: CustomerDepositSummary
  /** The customer's loaded accounts, as the profile already lists them. */
  agingAccounts: InstallmentSchedule[]
  canApply: boolean
  /** Called after a request is made or cancelled, so the profile reloads. */
  onChanged: () => void
}) {
  const unapplied = round2(summary.received - summary.applied)
  const hasDeposits = summary.deposits.length > 0

  // The accounts a request can name: loaded, open, with what is still free on
  // each once other waiting requests' holds are taken off.
  const accounts = useMemo(
    () =>
      agingAccounts.flatMap((p) => {
        const id = p.installmentAccount?.id
        const a = p.agingAccount
        if (!id || !a) return []
        const room = round2(a.outstanding - (summary.pendingByAccount[id] ?? 0))
        return [{ id, siNo: a.siNo, branchName: a.branchName, outstanding: a.outstanding, room }]
      }),
    [agingAccounts, summary.pendingByAccount]
  )
  const accountOptions = useMemo<SearchableSelectOption[]>(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.siNo} · ${a.branchName ?? 'No branch'} · ${fmtMoney(a.outstanding)} outstanding`,
      })),
    [accounts]
  )

  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<{ account?: string; amount?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const selected = accounts.find((a) => a.id === accountId)

  function startApply() {
    setOpen(true)
    setAccountId('')
    setAmount('')
    setRemarks('')
    setErrors({})
    setFormError(null)
  }

  /** The amount follows the account: the lower of what is available and what
   * the account still has room for. */
  function pickAccount(id: string) {
    setAccountId(id)
    setErrors((e) => ({ ...e, account: undefined }))
    const a = accounts.find((x) => x.id === id)
    if (a) setAmount(String(Math.max(0, Math.min(summary.available, a.room))))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: { account?: string; amount?: string } = {}
    const value = Number(amount)
    if (!accountId) next.account = 'Choose the aging account to apply the deposit to.'
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      next.amount = 'Amount to apply is required.'
    } else if (value > summary.available + 0.005) {
      next.amount = `It cannot be more than the deposit still available (${fmtMoney(summary.available)}).`
    } else if (selected && value > selected.room + 0.005) {
      next.amount = `It cannot be more than the account still owes (${fmtMoney(selected.room)}).`
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setFormError(null)
    const res = await CustomerDeposits.apply({
      customerId,
      installmentAccountId: accountId,
      amount: round2(value),
      ...(remarks.trim() && { remarks: remarks.trim() }),
    })
    setSaving(false)
    if (!res.success) {
      setFormError(humanizeDepositError(res.error))
      return
    }
    setOpen(false)
    onChanged()
  }

  async function cancel(app: DepositApplicationRow) {
    setBusyId(app.id)
    setListError(null)
    const res = await CustomerDeposits.cancel(app.id)
    setBusyId(null)
    if (!res.success) {
      setListError(humanizeDepositError(res.error))
      return
    }
    onChanged()
  }

  const pending = summary.applications.filter((a) => a.status === 'PENDING')
  const history = summary.applications.filter((a) => a.status !== 'PENDING').slice(0, 5)

  return (
    <section data-testid="deposits-card" className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-gray-900">Deposits</h2>
          <p className="mt-2 text-[12px] text-gray-500">Unapplied deposit</p>
          <p
            data-testid="deposit-unapplied"
            className="text-2xl font-semibold text-prominent-purple-700"
          >
            {fmtMoney(unapplied)}
          </p>
          <p className="text-[12px] text-gray-500">
            Received in total {fmtMoney(summary.received)}
          </p>
          {summary.reserved > 0 && (
            <p data-testid="deposit-reserved" className="mt-1 text-[12px] text-amber-700">
              {fmtMoney(summary.reserved)} is reserved for requests waiting for approval ·{' '}
              {fmtMoney(summary.available)} still available to apply
            </p>
          )}
        </div>
        {canApply && hasDeposits && !open && (
          <button
            type="button"
            onClick={startApply}
            disabled={summary.available <= 0 || accounts.length === 0}
            title={
              summary.available <= 0
                ? 'The whole deposit is already applied or waiting for approval'
                : accounts.length === 0
                  ? 'This customer has no open aging account'
                  : undefined
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply deposit
          </button>
        )}
      </div>

      {!canApply && hasDeposits && (
        <p data-testid="deposit-view-only" className="mt-3 text-[12px] text-gray-500">
          View only. Applying a deposit is done by Head Office AR.
        </p>
      )}

      {open && (
        <form
          noValidate
          onSubmit={submit}
          data-testid="apply-deposit-form"
          className="mt-4 space-y-3 border-t border-gray-100 pt-4"
        >
          <p className="text-[13px] font-medium text-gray-800">
            Choose the aging account to apply the deposit to
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-800">
                Aging account <span className="text-red-600">*</span>
              </span>
              <SearchableSelect
                value={accountId}
                onChange={pickAccount}
                options={accountOptions}
                placeholder="Select an aging account…"
                ariaLabel="Aging account"
              />
              {errors.account && (
                <span className="mt-1 block text-xs text-red-600">{errors.account}</span>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-800">
                Amount to apply <span className="text-red-600">*</span>
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setErrors((x) => ({ ...x, amount: undefined }))
                }}
                aria-label="Amount to apply"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              {errors.amount && (
                <span className="mt-1 block text-xs text-red-600">{errors.amount}</span>
              )}
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-800">
              Remarks <span className="font-normal text-gray-500">(optional)</span>
            </span>
            <input
              value={remarks}
              maxLength={500}
              onChange={(e) => setRemarks(e.target.value)}
              aria-label="Remarks"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {saving ? 'Submitting…' : 'Submit for approval'}
            </button>
          </div>
        </form>
      )}

      {pending.length > 0 && (
        <div data-testid="deposit-requests" className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-1 text-[12px] font-medium text-gray-600">Waiting for approval</p>
          <ul className="divide-y divide-gray-100">
            {pending.map((a) => (
              <li
                key={a.id}
                data-testid="deposit-request-row"
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="text-gray-800">
                    <span className="font-semibold">{fmtMoney(a.amount)}</span> to{' '}
                    <span className="font-mono text-[12px] font-medium">{a.siNo}</span>
                    <span className="ml-2 text-gray-500">{a.branchName ?? 'No branch'}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-gray-500">
                    Requested {fmtDate(a.requestedAt)}
                    {a.requestedBy ? ` by ${a.requestedBy}` : ''}
                    {a.remarks ? ` — ${a.remarks}` : ''} · posts as of the deposit date,{' '}
                    {fmtDate(a.entryDate)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <DepositStatusChip status={a.status} />
                  {canApply && (
                    <button
                      type="button"
                      onClick={() => cancel(a)}
                      disabled={busyId === a.id}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {busyId === a.id ? 'Cancelling…' : 'Cancel request'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {listError && <p className="mt-1 text-xs text-red-600">{listError}</p>}
        </div>
      )}

      {hasDeposits ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Date</th>
                <th className="py-1.5 pr-3 font-medium">Details</th>
                <th className="py-1.5 pr-3 font-medium">Reference</th>
                <th className="py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.deposits.map((d) => (
                <tr key={d.id} data-testid="deposit-row" className="border-t border-gray-100">
                  <td className="py-2 pr-3 text-gray-700">{fmtDate(d.date)}</td>
                  <td className="py-2 pr-3">
                    <p className="text-gray-800">Deposit received</p>
                    <p className="text-[12px] text-gray-500">Received in {d.receivedIn}</p>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[12px] text-gray-700">
                    {d.reference ?? '—'}
                  </td>
                  <td className="py-2 text-right text-gray-900">{fmtMoney(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 py-2 text-center text-[13px] text-gray-400">
          No deposits for this customer.
        </p>
      )}

      {history.length > 0 && (
        <div data-testid="deposit-history" className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-1 text-[12px] font-medium text-gray-600">Recent requests</p>
          <ul className="divide-y divide-gray-100">
            {history.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-2 py-2 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="text-gray-800">
                    <span className="font-semibold">{fmtMoney(a.amount)}</span> to{' '}
                    <span className="font-mono text-[12px] font-medium">{a.siNo}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-gray-500">
                    {a.status === 'APPROVED' && a.postingDate
                      ? `Applied ${a.resolvedAt ? fmtDate(a.resolvedAt) : ''}, posted as of the deposit date ${fmtDate(a.postingDate)}${a.resolvedBy ? ` — approved by ${a.resolvedBy}` : ''}`
                      : a.status === 'REJECTED'
                        ? `Rejected${a.resolvedBy ? ` by ${a.resolvedBy}` : ''}${a.rejectionReason ? `: ${a.rejectionReason}` : ''}`
                        : `Cancelled ${a.resolvedAt ? fmtDate(a.resolvedAt) : ''}`}
                  </p>
                </div>
                <DepositStatusChip status={a.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
