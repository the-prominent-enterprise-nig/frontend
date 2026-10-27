'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Package,
  Printer,
  Receipt,
  UserRound,
} from 'lucide-react'
import { useMe } from '@/src/hooks/useMe'
import { hasPermission } from '@/src/hooks/usePermission'
import { installmentAccountsApi } from '@/src/libs/api/crm'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { printCustomerLedgerDocument } from '@/src/libs/print/printInventoryDocument'
import type { InstallmentLedger } from '@/src/schema/crm/types'
import { XDealBadge } from '@/src/components/pos/XDealBadge'
import {
  LEDGER_ACTION,
  LedgerCard,
  LedgerFields,
  LedgerHero,
  LedgerTable,
} from '@/src/components/crm/LedgerParts'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  closed: 'Closed',
  early_closed: 'Paid Off Early',
  written_off: 'Written Off',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
  early_closed: 'bg-green-100 text-green-700',
  written_off: 'bg-red-100 text-red-700',
}

// Shared by Accounting's customer view (/accounting/customers/[id]/installments/[accountId])
// and CRM's (/crm/customers/[id]/installments/[accountId]) — same ledger data
// either way, just a different back link and "full account details" is
// always CRM's own installment-account page regardless of entry point.
//
// Field groups mirror the client's paper "Customer Ledger" form (sale info,
// item, assignment, financing terms, totals, then the Date/Ref/Inst./
// Description/Debit/Credit/Due/Outstanding table) — see
// InstallmentAccountService.getLedger()'s doc comment for exactly which
// paper-form fields/rows this can and can't reproduce from real data (no
// itemized Total Penalty separate from Penalty Balance, no memo-only voucher
// rows; the paper form's Unit Manager is left off at the client's request).
// Cards, the figures band and the table come from LedgerParts.tsx, so this and
// the whole-customer ledger look alike (and like the CRM account page).
export default function InstallmentLedgerView({
  accountId,
  backHref,
  backLabel,
}: {
  accountId: string
  backHref: string
  backLabel: string
}) {
  const [ledger, setLedger] = useState<InstallmentLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    installmentAccountsApi.getLedger(accountId).then((res) => {
      if (res.success && res.data) {
        setLedger(res.data)
      } else {
        setError(res.message || res.error || 'Ledger not found')
      }
      setLoading(false)
    })
  }, [accountId])

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <div>
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        {loading ? (
          <div className="mt-6 text-center text-gray-500">Loading…</div>
        ) : error || !ledger ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error ?? 'Ledger not found'}
          </div>
        ) : (
          <InstallmentLedgerBody ledger={ledger} accountId={accountId} />
        )}
      </div>
    </div>
  )
}

/** The ledger itself, once loaded — the header with the balances that matter,
 * the Sale/Item/Assignment sections and the Date/Ref/… table (the financing
 * terms are on the account page; the printout still carries them).
 * Split out so CustomerLedgerView can draw the very same view at
 * /ledger?transactionId=acct:<id> without a second copy of it.
 * `showAccountLink` is false where the CRM installment-account page isn't
 * reachable (a POS cashier bounces off it). */
export function InstallmentLedgerBody({
  ledger,
  accountId,
  showAccountLink = true,
}: {
  ledger: InstallmentLedger
  accountId: string
  showAccountLink?: boolean
}) {
  // What an agent earns is agent data — the same permission that guards the
  // agents list (and its commission rate) guards it here, and on the printout.
  const { data: me } = useMe()
  const canViewCommission = !!me && hasPermission(me, CRM_PERMISSIONS.AGENTS_READ)

  // Scenario 67 — a closed X-Deal was settled by its memo, not by payments;
  // the memo is the ledger's own credit row, so its number comes from there.
  const xDealMemoRef =
    ledger.account.isXDeal && ledger.account.status === 'closed'
      ? (ledger.rows.find((r) => r.description === 'X-Deal credit memo')?.ref ?? null)
      : null

  return (
    <>
      <LedgerHero
        header={
          <>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-prominent-purple-900">
                  Customer Ledger
                </h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[ledger.account.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                  data-testid="ledger-status"
                >
                  {xDealMemoRef
                    ? `Settled — X-Deal credit memo ${xDealMemoRef}`
                    : (STATUS_LABELS[ledger.account.status] ?? ledger.account.status)}
                </span>
                {ledger.account.isXDeal && <XDealBadge reference={ledger.account.xDealReference} />}
              </div>
              <p className="mt-1 text-[13px] text-gray-600">
                <span className="font-medium text-gray-700">{ledger.account.customer.name}</span>
                {' · '}
                <span className="font-mono">{ledger.account.accountNumber}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  printCustomerLedgerDocument(ledger, { showCommission: canViewCommission })
                }
                className={LEDGER_ACTION}
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              {showAccountLink && (
                <Link
                  href={`/crm/installment-accounts/${accountId}`}
                  className={`${LEDGER_ACTION} text-prominent-purple-700`}
                >
                  Full account details <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </>
        }
        figures={[
          { label: 'Tot. Amt. Out', value: fmtMoney(ledger.account.currentBalance), accent: true },
          { label: 'Tot. Amt. Due', value: fmtMoney(ledger.account.totalDue) },
          { label: 'Total Payments', value: fmtMoney(ledger.account.totalPayments) },
          { label: 'Total Billing', value: fmtMoney(ledger.account.totalBilling) },
          { label: 'Total Rebates', value: fmtMoney(ledger.account.totalRebates) },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LedgerCard title="Sale" icon={Receipt}>
          <LedgerFields
            columns={3}
            fields={[
              {
                label: 'Lastname',
                value: ledger.account.customer.lastName ?? ledger.account.customer.name,
              },
              { label: 'Firstname', value: ledger.account.customer.firstName ?? '—' },
              { label: 'Middle', value: ledger.account.customer.middleName ?? '—' },
              { label: 'Sales Invoice No.', value: ledger.saleReference ?? '—' },
              { label: 'SI Date', value: ledger.saleDate ? fmtDate(ledger.saleDate) : '—' },
            ]}
          />
        </LedgerCard>

        {ledger.account.unitItems.length > 0 && (
          <LedgerCard title="Item" icon={Package}>
            <LedgerFields
              fields={[
                { label: 'Brand', value: ledger.account.unitItems[0].brand ?? '—' },
                { label: 'Type', value: ledger.account.unitItems[0].itemType ?? '—' },
                { label: 'Model', value: ledger.account.unitItems[0].modelNumber ?? '—' },
                {
                  label: 'Serial',
                  value:
                    ledger.account.unitItems[0].serialNumber ??
                    (ledger.account.unitItems.length > 1
                      ? `+${ledger.account.unitItems.length - 1} more item(s)`
                      : '—'),
                },
              ]}
            />
          </LedgerCard>
        )}

        <LedgerCard title="Assignment" icon={UserRound}>
          <LedgerFields
            fields={[
              { label: 'Agent', value: ledger.account.sellingAgent?.name ?? '—' },
              ...(canViewCommission
                ? [
                    {
                      label: 'Sales Commission',
                      value: Number(ledger.account.salesCommission ?? 0)
                        ? fmtMoney(ledger.account.salesCommission ?? 0)
                        : '—',
                    },
                  ]
                : []),
              {
                label: 'Collector',
                value: ledger.account.collector
                  ? `${ledger.account.collector.stubNumber} — ${ledger.account.collector.name}`
                  : 'Unassigned',
              },
              {
                label: 'FMI',
                value: ledger.firstInstallmentDate ? fmtDate(ledger.firstInstallmentDate) : '—',
              },
            ]}
          />
        </LedgerCard>
      </div>

      <LedgerCard title="Ledger" icon={BookOpen} className="mt-4">
        <LedgerTable rows={ledger.rows} />
      </LedgerCard>
    </>
  )
}
