'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle, FileEdit, Trash2, Printer } from 'lucide-react'
import {
  BankAccounts,
  ClearingSettlements,
  UnidentifiedBankCredits,
  type BankReconciliation,
  type ClearingSettlement,
  type UnidentifiedBankCredit,
  fmtMoney,
  fmtDate,
  adjustedStatementBalance,
  reconStatus,
  RECON_STATUS_STYLE,
} from '@/src/libs/data/AccountingV2Data'
import { RowActionsMenu } from '@/src/components/ui/RowActionsMenu'
import { CLEARING_TYPE_LABELS, printVoucher } from './BankReconForms'

// Scenario 42 Part 3 / Scenario 61 Part C — the real discrepancy from the
// worksheet lines: checked = cleared on the statement, unchecked = still
// outstanding, so the bank side is the statement balance adjusted by the
// outstanding items only (same rule as the backend's markReconciled()).
function reconDiscrepancy(r: BankReconciliation): number {
  return adjustedStatementBalance(r.statementBalance, r.lines ?? []) - r.systemBalance
}

export default function BankRecon() {
  const router = useRouter()
  const [recs, setRecs] = useState<BankReconciliation[]>([])
  const [settlements, setSettlements] = useState<ClearingSettlement[]>([])
  const [credits, setCredits] = useState<UnidentifiedBankCredit[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, s, c] = await Promise.all([
      BankAccounts.listReconciliations(),
      ClearingSettlements.list(),
      UnidentifiedBankCredits.list(),
    ])
    setRecs(r.data ?? [])
    setSettlements(s.data ?? [])
    setCredits(c.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const complete = async (id: string) => {
    const res = await BankAccounts.completeReconciliation(id)
    if (!res.success) {
      alert(res.message || res.error || 'Failed to complete reconciliation')
      return
    }
    load()
  }
  // Deleting a completed one hands its cleared payments back to the next
  // worksheet, so the confirm says how many are coming back.
  const remove = async (r: BankReconciliation) => {
    const clearedCount = (r.lines ?? []).filter((l) => l.checked).length
    const warning =
      r.reconciled && clearedCount > 0
        ? `Delete this completed reconciliation? The ${clearedCount} item${
            clearedCount === 1 ? '' : 's'
          } it cleared go back to pending and reappear in this account's next worksheet.`
        : 'Delete this reconciliation? Its worksheet is discarded.'
    if (!confirm(`${warning} This cannot be undone.`)) return
    const res = await BankAccounts.deleteReconciliation(r.id)
    if (!res.success) {
      alert(res.message || res.error || 'Failed to delete reconciliation')
      return
    }
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Bank Reconciliation</h2>
          <p className="text-sm text-gray-500">Compare bank statements to system records.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/accounting/bank-reconciliation/adjusting-entry"
            className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg"
          >
            <FileEdit className="w-4 h-4" /> Adjusting Entry
          </Link>
          <Link
            href="/accounting/bank-reconciliation/unidentified-credit"
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg"
          >
            <Plus className="w-4 h-4" /> Unidentified Credit
          </Link>
          <Link
            href="/accounting/bank-reconciliation/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Reconciliation
          </Link>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Statement Date</th>
              <th className="px-3 py-2 text-right">Statement Balance</th>
              <th className="px-3 py-2 text-right">System Balance</th>
              <th className="px-3 py-2 text-right">Difference</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 w-10" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : recs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  No reconciliations.
                </td>
              </tr>
            ) : (
              recs.map((r) => {
                const discrepancy = reconDiscrepancy(r)
                const isZero = Math.abs(discrepancy) < 0.01
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/accounting/bank-reconciliation/${r.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">{r.bankAccount?.name}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(r.statementDate)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.statementBalance)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.systemBalance)}</td>
                    <td className="px-3 py-2 text-right">
                      {/* Scenario 61 Part C — the Difference drills into
                          every transaction behind the ERP bank balance. */}
                      <Link
                        href={`/accounting/bank-reconciliation/${r.id}/transactions`}
                        onClick={(e) => e.stopPropagation()}
                        title="See every transaction behind this difference"
                        className={`underline decoration-dotted underline-offset-2 hover:decoration-solid ${isZero ? 'text-emerald-700' : 'text-amber-700'}`}
                      >
                        {fmtMoney(discrepancy)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={RECON_STATUS_STYLE[reconStatus(r.reconciled, discrepancy)]}>
                        {reconStatus(r.reconciled, discrepancy)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        horizontal
                        items={[
                          // Only offered once the discrepancy is zero — until then the
                          // worksheet is where cleared items get checked off.
                          ...(!r.reconciled && isZero
                            ? [
                                {
                                  label: 'Mark reconciled',
                                  icon: CheckCircle,
                                  variant: 'success' as const,
                                  onClick: () => complete(r.id),
                                },
                              ]
                            : []),
                          {
                            label: 'Delete reconciliation',
                            icon: Trash2,
                            variant: 'danger' as const,
                            onClick: () => remove(r),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {(loading || settlements.length > 0) && (
        <>
          <div className="mt-6 flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold">Clearing Settlements</h3>
              <p className="text-xs text-gray-500">
                Card/e-wallet/bank-transfer batches and TPF partner receivables settling into the
                bank.
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Bank Account</th>
                  <th className="px-3 py-2 text-left">Settled</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Fee</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  settlements.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2">
                        {CLEARING_TYPE_LABELS[s.clearingType]}
                        {s.tpfProvider && (
                          <span className="text-gray-500"> — {s.tpfProvider.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{s.bankAccount?.name}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(s.settledAt)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(s.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        {s.feeAmount > 0 ? fmtMoney(s.feeAmount) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">{s.referenceNo || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(loading || credits.length > 0) && (
        <>
          <div className="mt-6 flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold">Unidentified Bank Credits</h3>
              <p className="text-xs text-gray-500">
                Bank credits with no matching sale or settlement yet — reclassify once identified.
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Bank Account</th>
                  <th className="px-3 py-2 text-left">Credit Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Bank Ref</th>
                  <th className="px-3 py-2 text-left">Voucher Control No.</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 w-10" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  credits.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2">{c.bankAccount?.name}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(c.creditDate)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(c.amount)}</td>
                      <td className="px-3 py-2 text-xs">{c.bankRef || '—'}</td>
                      <td className="px-3 py-2 text-xs">{c.voucherControlNo || '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.status === 'unmatched' ? (
                          <span className="text-amber-700">Unmatched</span>
                        ) : (
                          <span className="text-emerald-700" title={c.reclassifiedNote ?? ''}>
                            Reclassified
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <RowActionsMenu
                          horizontal
                          items={[
                            ...(c.journalEntryId
                              ? [
                                  {
                                    label: 'Print voucher',
                                    icon: Printer,
                                    onClick: () =>
                                      printVoucher(
                                        c.journalEntryId!,
                                        'Unidentified Bank Credit Voucher'
                                      ),
                                  },
                                ]
                              : []),
                            ...(c.status === 'unmatched'
                              ? [
                                  {
                                    label: 'Reclassify',
                                    icon: FileEdit,
                                    onClick: () =>
                                      router.push(
                                        `/accounting/bank-reconciliation/unidentified-credit/${c.id}/reclassify`
                                      ),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(loading || credits.length > 0) && (
        <>
          <div className="mt-6 flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold">Unidentified Bank Credits</h3>
              <p className="text-xs text-gray-500">
                Bank credits with no matching sale or settlement yet — reclassify once identified.
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Bank Account</th>
                  <th className="px-3 py-2 text-left">Credit Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Bank Ref</th>
                  <th className="px-3 py-2 text-left">Voucher Control No.</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 w-10" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  credits.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2">{c.bankAccount?.name}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(c.creditDate)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(c.amount)}</td>
                      <td className="px-3 py-2 text-xs">{c.bankRef || '—'}</td>
                      <td className="px-3 py-2 text-xs">{c.voucherControlNo || '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.status === 'unmatched' ? (
                          <span className="text-amber-700">Unmatched</span>
                        ) : (
                          <span className="text-emerald-700" title={c.reclassifiedNote ?? ''}>
                            Reclassified
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.journalEntryId && (
                            <button
                              onClick={() =>
                                printVoucher(c.journalEntryId!, 'Unidentified Bank Credit Voucher')
                              }
                              title="Print voucher"
                              aria-label="Print voucher"
                              className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {c.status === 'unmatched' && (
                            <Link
                              href={`/accounting/bank-reconciliation/unidentified-credit/${c.id}/reclassify`}
                              className="px-2 py-1 text-xs text-purple-700 hover:bg-purple-50 border border-purple-200 rounded"
                            >
                              Reclassify
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
