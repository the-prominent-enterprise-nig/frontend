'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useMe } from '@/src/hooks/useMe'
import { hasPermission } from '@/src/hooks/usePermission'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { MANILA_TZ } from '@/src/libs/format/manila-date'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { printCustomerLedgerDocument } from '@/src/libs/print/printInventoryDocument'
import { LEDGER_ACTION, LEDGER_CARD } from '@/src/components/crm/LedgerParts'
import type {
  ExistingLedgerSummary,
  InstallmentLedger,
  InstallmentLedgerRow,
} from '@/src/schema/crm/types'

// Docket NIG #38 — "Interface for Existing customer ledger": the ledger of an
// account carried over from the client's aging sheet. The server works every
// figure out of the very rows the table shows (see ExistingLedgerSummary), so
// the page is layout only: the header with its actions, the months-running
// band, Account info and Totals beside each other, and the ledger with the
// beginning-balance cut-off marked in it.
//
// Left off the mockup on purpose: the "Active" badge (an account being active
// is not worth a badge — only a closed/settled state is shown) and the
// "W/tax received" tick box (nothing defines what it does yet).

const NON_ACTIVE_STATUS: Record<string, { label: string; style: string }> = {
  closed: { label: 'Closed', style: 'bg-green-100 text-green-700' },
  early_closed: { label: 'Paid Off Early', style: 'bg-green-100 text-green-700' },
  written_off: { label: 'Written Off', style: 'bg-red-100 text-red-700' },
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    timeZone: MANILA_TZ,
  })

/** "Oct 2", "Oct 2 and Nov 2", "Oct 2, Nov 2 and Dec 2". */
function listDates(dates: string[]): string {
  const names = dates.map(shortDate)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export default function ExistingAccountLedger({
  ledger,
  existing,
  accountId,
  showAccountLink = true,
}: {
  ledger: InstallmentLedger
  existing: ExistingLedgerSummary
  accountId: string
  /** False where the CRM installment-account pages aren't reachable (a POS
   * cashier bounces off them) — Edit goes with it. */
  showAccountLink?: boolean
}) {
  const { data: me } = useMe()
  const canViewCommission = !!me && hasPermission(me, CRM_PERMISSIONS.AGENTS_READ)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { account } = ledger
  const status = NON_ACTIVE_STATUS[account.status]
  const matured = existing.billed >= existing.term

  // Record payment goes where the payment is posted: AR New Receipt, with this
  // account's one invoice picked (same as the account page does for a loaded
  // account), and back here afterwards.
  const here = `${pathname}${searchParams.toString() ? `?${searchParams}` : ''}`
  const paymentHref = account.arInvoiceId
    ? `/accounting/ar-invoices/receipts/new?${new URLSearchParams({
        customerId: account.customerId,
        customerName: account.customer?.name ?? '',
        invoiceId: account.arInvoiceId,
        returnTo: here,
      })}`
    : null
  const canRecordPayment =
    account.status === 'active' &&
    !!paymentHref &&
    !!me &&
    hasPermission(me, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_RECORD_PAYMENT) &&
    hasPermission(me, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ) &&
    hasPermission(me, ACCOUNTING_PERMISSIONS.AR_INVOICES_PAY)
  const canEdit =
    showAccountLink && !!me && hasPermission(me, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_UPDATE)

  return (
    <div data-testid="existing-ledger">
      <header
        className={`${LEDGER_CARD} flex flex-wrap items-start justify-between gap-3 px-5 py-4`}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-prominent-purple-900">
              {account.customer?.name}
            </h1>
            {status && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.style}`}
                data-testid="ledger-status"
              >
                {status.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-gray-600">
            SI <span className="font-mono">{ledger.saleReference ?? '—'}</span>
            {' · '}
            <span className="font-mono">{account.accountNumber}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canRecordPayment && paymentHref && (
            <Link
              href={paymentHref}
              className="inline-flex items-center justify-center rounded-xl bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-purple-800"
            >
              Record payment
            </Link>
          )}
          <button
            type="button"
            onClick={() =>
              printCustomerLedgerDocument(ledger, { showCommission: canViewCommission })
            }
            className={LEDGER_ACTION}
          >
            Print
          </button>
          {canEdit && (
            <Link href={`/crm/installment-accounts/${accountId}/edit`} className={LEDGER_ACTION}>
              Edit
            </Link>
          )}
        </div>
      </header>

      <MonthsRunning existing={existing} matured={matured} />

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <AccountInfo ledger={ledger} existing={existing} matured={matured} />
        <Totals existing={existing} />
      </div>

      <LedgerRows rows={ledger.rows} existing={existing} matured={matured} />
    </div>
  )
}

/** "Balance as of (beginning balance upload)" and the term as twelve little
 * segments: dark for the installments billed at the cut-off, light for the
 * ones posted since, grey for what is still to come. */
function MonthsRunning({
  existing,
  matured,
}: {
  existing: ExistingLedgerSummary
  matured: boolean
}) {
  const { term, billed, billedAtCutoff } = existing
  const arrears = existing.installmentsWithBalance
  return (
    <section
      className={`${LEDGER_CARD} mt-3 flex flex-wrap items-center gap-x-10 gap-y-3 px-5 py-3`}
    >
      <div className="shrink-0">
        <p className="text-[12px] text-gray-600">Balance as of (beginning balance upload)</p>
        <p className="mt-0.5 text-[15px] font-semibold text-prominent-purple-900">
          {fmtDate(existing.asOf)}
        </p>
      </div>
      <div className="min-w-[16rem] flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-[12px] text-gray-600">
          <span>Months running</span>
          <span data-testid="months-running-text">
            <strong className="font-semibold text-prominent-purple-900">
              {billed} of {term}
            </strong>
            {matured
              ? ` · fully billed${arrears > 0 ? ` · ${arrears} installment${arrears === 1 ? '' : 's'} in arrears` : ''}`
              : ` · ${term - billed} remaining · ${billedAtCutoff} were running at the ${shortDate(existing.asOf)} cut-off`}
          </span>
        </div>
        <div
          className="mt-1.5 flex gap-1"
          role="img"
          aria-label={`${billed} of ${term} months running`}
        >
          {Array.from({ length: term }, (_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i < billedAtCutoff
                  ? 'bg-prominent-purple-700'
                  : i < billed
                    ? 'bg-prominent-purple-300'
                    : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function Card({
  title,
  className = '',
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`${LEDGER_CARD} p-4 ${className}`}>
      <h2 className="mb-3 text-[14px] font-semibold text-prominent-purple-900">{title}</h2>
      {children}
    </section>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <dl className="space-y-1">{children}</dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-right font-semibold text-prominent-purple-900">{value}</dd>
    </div>
  )
}

function AccountInfo({
  ledger,
  existing,
  matured,
}: {
  ledger: InstallmentLedger
  existing: ExistingLedgerSummary
  matured: boolean
}) {
  const { account } = ledger
  const c = existing.contract
  const hasUnit = !!(c.unitDescription || c.unitType)
  return (
    <Card title="Account info" className="lg:col-span-2">
      <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
        <div className="space-y-4">
          <Group title="Sale">
            <Row label="Invoice no." value={ledger.saleReference ?? '—'} />
            <Row label="SI date" value={fmtDate(ledger.saleDate)} />
            <Row label="FMI" value={fmtDate(ledger.firstInstallmentDate)} />
            {hasUnit && (
              <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2" data-testid="ledger-unit">
                <p className="text-[11px] text-gray-500">Unit</p>
                <p className="text-[13px] font-semibold text-prominent-purple-900">
                  {c.unitDescription ?? '—'}
                </p>
                {c.unitType && <p className="text-[12px] text-gray-600">{c.unitType}</p>}
              </div>
            )}
          </Group>
          <Group title="Assignment">
            <Row label="Agent" value={c.agent ?? '—'} />
            <Row label="Collector" value={account.collector?.name ?? '—'} />
            <Row label="Collector code" value={account.collector?.stubNumber ?? '—'} />
          </Group>
          <Group title="Customer">
            <Row label="Address" value={c.address ?? '—'} />
          </Group>
        </div>
        <div className="space-y-4">
          <Group title="Financing">
            <Row label="LCP" value={fmtMoney(c.listedCashPrice)} />
            <Row label="Down payment" value={fmtMoney(c.downPayment)} />
            <Row label="DP balance" value={fmtMoney(c.dpBalance)} />
            <Row label="MI (monthly installment)" value={fmtMoney(existing.monthlyInstallment)} />
            <Row label="Rebate" value={fmtMoney(c.rebate)} />
            <Row label="Term" value={`${existing.term} months`} />
            <Row label="Months running" value={existing.billed} />
            <Row
              label={matured ? 'Installments in arrears' : 'Installments with balance'}
              value={existing.installmentsWithBalance}
            />
          </Group>
          <Group title="Financing (cont.)">
            <Row label="PNV (amt. financed)" value={fmtMoney(c.pnv)} />
            <Row label="Total price" value={fmtMoney(c.totalPrice)} />
            <Row label="Paid vs. total price" value={`${existing.paidPercent}%`} />
          </Group>
        </div>
      </div>
    </Card>
  )
}

function Totals({ existing }: { existing: ExistingLedgerSummary }) {
  const c = existing.contract
  const penalty = existing.penalty
  return (
    <Card title="Totals">
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5"
        data-testid="total-amt-due"
      >
        <p className="text-[12px] text-gray-600">Total amt due</p>
        <p
          className={`text-2xl font-semibold tracking-tight ${
            existing.totalDue < 0 ? 'text-red-600' : 'text-prominent-orange-800'
          }`}
        >
          {fmtMoney(existing.totalDue)}
        </p>
        <p className="text-[11px] text-gray-600">
          {existing.penaltyInDue
            ? `MI due ${fmtMoney(existing.miDue)} + penalty ${fmtMoney(penalty)}`
            : penalty > 0
              ? `MI due ${fmtMoney(existing.miDue)} · excl. penalty ${fmtMoney(penalty)}`
              : `MI due ${fmtMoney(existing.miDue)}`}
        </p>
      </div>
      <div
        className="mt-2 rounded-xl border border-prominent-purple-200 bg-prominent-purple-50 px-3.5 py-2.5"
        data-testid="total-amt-outstanding"
      >
        <p className="text-[12px] text-gray-600">Total amt outstanding</p>
        <p className="text-2xl font-semibold tracking-tight text-prominent-purple-800">
          {fmtMoney(existing.outstanding)}
        </p>
      </div>
      <dl className="mt-3 space-y-1">
        <Row label="Total payments" value={fmtMoney(existing.totalPayments)} />
        <Row label="Total penalty" value={fmtMoney(penalty)} />
        <Row label="Penalty balance" value={fmtMoney(penalty)} />
        <Row label="Total rebates" value={fmtMoney(existing.totalRebates)} />
        <Row label="Total billings" value={fmtMoney(existing.totalBilling)} />
        <Row label="Required DP" value={fmtMoney(c.downPayment)} />
        <Row label="DP balance" value={fmtMoney(c.dpBalance)} />
      </dl>
    </Card>
  )
}

const PILL = {
  blue: 'bg-blue-50 text-blue-700',
  purple: 'bg-prominent-purple-100 text-prominent-purple-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
} as const

/** The little tag before a row's description, by what kind of event it is. */
function kindOf(description: string): { label: string; style: string } | null {
  if (description === 'Sale') return { label: 'Sale', style: PILL.blue }
  if (description === 'Required DP') return { label: 'Required DP', style: PILL.purple }
  if (description === 'Bill' || description.startsWith('Billing '))
    return { label: 'Bill', style: PILL.blue }
  if (description === 'Late Penalty' || description === 'Penalty')
    return { label: 'Penalty', style: PILL.amber }
  if (description === 'Rebate') return { label: 'Rebate', style: PILL.green }
  if (
    description === 'Down payment' ||
    description.startsWith('Payment') ||
    description.startsWith('Prior payments')
  )
    return { label: 'Payment', style: PILL.green }
  return null
}

const isPenaltyRow = (r: InstallmentLedgerRow) =>
  r.description === 'Late Penalty' || r.description === 'Penalty'

function LedgerRows({
  rows,
  existing,
  matured,
}: {
  rows: InstallmentLedgerRow[]
  existing: ExistingLedgerSummary
  matured: boolean
}) {
  const cutoff = new Date(existing.asOf).getTime()
  // The cut-off sits before the first row dated after it (or at the foot).
  const firstAfter = rows.findIndex((r) => new Date(r.date).getTime() > cutoff)
  const markerAt = firstAfter === -1 ? rows.length : firstAfter

  // A display-only row (a Bill, the Billing lump, the penalty memo) is shown
  // but never added in — its amount is already in the Sale row.
  const sum = (pick: (r: InstallmentLedgerRow) => number) =>
    rows.filter((r) => !r.displayOnly).reduce((total, r) => total + pick(r), 0)

  const since = existing.billsSince.map((b) => b.date)
  const markerNote = matured
    ? `${existing.term} of ${existing.term} installments billed · no further bills to post`
    : `${existing.billedAtCutoff} of ${existing.term} installments billed at cut-off · ${
        since.length
          ? `${listDates(since)} billing${since.length === 1 ? '' : 's'} posted since`
          : 'no billings posted since'
      }`

  const marker = (
    <tr key="cutoff" data-testid="cutoff-marker">
      <td colSpan={8} className="px-0 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-dashed border-prominent-purple-300 bg-prominent-purple-50 px-3 py-1.5 text-[12px] text-prominent-purple-700">
          <span className="font-semibold">
            Beginning balance cut-off · {fmtDate(existing.asOf)}
          </span>
          <span>{markerNote}</span>
        </div>
      </td>
    </tr>
  )

  const body: ReactNode[] = []
  rows.forEach((row, i) => {
    if (i === markerAt) body.push(marker)
    const kind = kindOf(row.description)
    body.push(
      <tr
        key={i}
        className={isPenaltyRow(row) ? 'bg-amber-50' : 'hover:bg-gray-50'}
        data-testid={isPenaltyRow(row) ? 'penalty-row' : undefined}
      >
        <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">{fmtDate(row.date)}</td>
        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[13px] text-gray-600">
          {row.ref || '—'}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-gray-600">
          {row.instLabel ?? (row.inst > 0 ? row.inst : '—')}
        </td>
        <td className="px-3 py-1.5">
          <span className="inline-flex flex-wrap items-center gap-2">
            {kind && (
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${kind.style}`}>
                {kind.label}
              </span>
            )}
            <span className="font-medium text-prominent-purple-900">
              {isPenaltyRow(row) ? 'Penalty' : row.description}
            </span>
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-800">
          {row.debit > 0 ? fmtMoney(row.debit) : '—'}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-emerald-700">
          {row.credit > 0 ? fmtMoney(row.credit) : '—'}
        </td>
        <td
          className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
            row.due < 0
              ? 'text-red-600'
              : row.due > 0
                ? 'font-medium text-prominent-orange-800'
                : 'text-gray-800'
          }`}
        >
          {fmtMoney(row.due)}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums text-prominent-purple-900">
          {fmtMoney(row.outstanding)}
        </td>
      </tr>
    )
  })
  if (markerAt === rows.length) body.push(marker)

  return (
    <Card title="Ledger" className="mt-3">
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Inst.</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-right">Due</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">{body}</tbody>
          <tfoot>
            <tr className="border-t-2 border-prominent-purple-100 bg-prominent-purple-50 font-semibold text-prominent-purple-900">
              <td className="px-3 py-2" colSpan={4}>
                Total
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {fmtMoney(sum((r) => r.debit))}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {fmtMoney(sum((r) => r.credit))}
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
