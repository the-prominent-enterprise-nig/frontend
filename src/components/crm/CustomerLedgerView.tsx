'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Pencil, Printer } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { printUnifiedCustomerLedgerDocument } from '@/src/libs/print/printInventoryDocument'
import type {
  Customer,
  CustomerLedger,
  CustomerLedgerScope,
  CustomerLedgerTransaction,
} from '@/src/schema/crm/types'

// Per-customer ledger of every purchase — in-house installment plans, TPF
// -financed sales, charge sales and cash sales, merged into one chronological
// Date/Ref/Inst./Description/Debit/Credit/Due/Outstanding table (same row
// shape as InstallmentLedgerView.tsx's per-account ledger). Unlike that view
// this can span several separate purchases, so there's no single sale/item/
// agent/financing-scheme to head it with — just customer info + totals across
// them all, not the paper-form field grid.
export default function CustomerLedgerView({
  customerId,
  backHref,
  backLabel,
  canEdit = false,
}: {
  customerId: string
  backHref: string
  backLabel: string
  canEdit?: boolean
}) {
  // Every purchase, not only the financed ones. This was briefly narrowed to
  // installments on the reasoning that a cash sale is settled at the counter
  // and so contributes a Debit and an equal Credit that never move
  // Outstanding — but that left a cash customer with no ledger at all, which
  // the client asked for by name: every transaction gets a ledger. The
  // transaction picker below is what makes the merged table readable, by
  // narrowing it to one purchase at a time.
  const router = useRouter()
  const searchParams = useSearchParams()
  const scope: CustomerLedgerScope = 'all'
  // Which single purchase to narrow to, kept in the URL so a narrowed ledger
  // stays linkable/bookmarkable and survives a refresh. `txn:<id>` is also
  // accepted here — that's the form the POS receipt modal links with.
  const transactionId = searchParams.get('transactionId') ?? ''

  const [ledger, setLedger] = useState<CustomerLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function setTransaction(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('transactionId', next)
    else params.delete('transactionId')
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [editingTax, setEditingTax] = useState(false)
  const [taxForm, setTaxForm] = useState({ taxId: '', isTaxExempt: false, taxExemptionRef: '' })
  const [savingTax, setSavingTax] = useState(false)
  const [taxError, setTaxError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // No synchronous setLoading(true) here: when the picker changes the
    // existing rows stay on screen until the new ones land, instead of
    // flashing "Loading…" — the picker's own selected value is the feedback.
    // Both branches reset error so a recovered fetch clears a stale one.
    customersApi.getLedger(customerId, scope, transactionId || undefined).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setLedger(res.data)
        setError(null)
      } else {
        setError(res.message || res.error || 'Ledger not found')
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [customerId, scope, transactionId])

  // Customer/tax info doesn't vary with the transaction filter — kept in its
  // own effect so narrowing the ledger doesn't refetch it (and blow away an
  // in-progress tax edit).
  useEffect(() => {
    customersApi.get(customerId).then((res) => {
      if (res.success && res.data) {
        setCustomer(res.data)
        setTaxForm({
          taxId: res.data.taxId ?? '',
          isTaxExempt: res.data.isTaxExempt,
          taxExemptionRef: res.data.taxExemptionRef ?? '',
        })
      }
    })
  }, [customerId])

  async function saveTaxInfo() {
    setSavingTax(true)
    setTaxError(null)
    const res = await customersApi.update(customerId, {
      taxId: taxForm.taxId,
      isTaxExempt: taxForm.isTaxExempt,
      taxExemptionRef: taxForm.taxExemptionRef,
    })
    setSavingTax(false)
    if (res.success && res.data) {
      setCustomer(res.data)
      setEditingTax(false)
    } else {
      setTaxError(res.message || res.error || 'Failed to save')
    }
  }

  function cancelTaxEdit() {
    if (customer) {
      setTaxForm({
        taxId: customer.taxId ?? '',
        isTaxExempt: customer.isTaxExempt,
        taxExemptionRef: customer.taxExemptionRef ?? '',
      })
    }
    setTaxError(null)
    setEditingTax(false)
  }

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

        {/* Own row — the back link above is inline-flex, so rendering these
            as siblings let them collide on one line. Kept outside the loading
            branch so the filters stay visible and clickable while refetching. */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Transaction picker — shown once there's a purchase to choose
              between. Every kind of sale is listed, not just the financed
              ones, so any one transaction can be read as its own ledger.
              A `txn:` id arriving from the POS receipt modal won't match an
              option (those are keyed by what the sale became), so it shows
              as its own entry rather than silently reading "All". */}
          {(ledger?.transactions.length ?? 0) > 0 && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              Transaction
              <select
                value={transactionId}
                onChange={(e) => setTransaction(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800"
              >
                <option value="">All transactions</option>
                {ledger?.transactions.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {transactionOptionLabel(tx)}
                  </option>
                ))}
                {transactionId && !ledger?.transactions.some((tx) => tx.id === transactionId) && (
                  <option value={transactionId}>This transaction</option>
                )}
              </select>
            </label>
          )}
        </div>

        {loading ? (
          <div className="mt-6 text-center text-gray-500">Loading…</div>
        ) : error || !ledger ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error ?? 'Ledger not found'}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Customer Ledger</h1>
                <p className="mt-1 text-sm text-gray-600">{ledger.customer.name}</p>
                <p className="font-mono text-xs text-gray-500">{ledger.customer.customerCode}</p>
              </div>
              <button
                type="button"
                onClick={() => printUnifiedCustomerLedgerDocument(ledger)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>

            {customer && (
              <section className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between p-4 pb-2">
                  <h2 className="text-[14px] font-semibold text-gray-900">Tax Info</h2>
                  {canEdit && !editingTax && (
                    <button
                      type="button"
                      onClick={() => setEditingTax(true)}
                      className="flex items-center gap-1 text-xs font-medium text-prominent-purple-700 hover:text-prominent-purple-800"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                </div>
                <div className="border-t border-gray-100 p-4 pt-3">
                  {editingTax ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">
                            Tax ID (TIN)
                          </span>
                          <input
                            value={taxForm.taxId}
                            onChange={(e) => setTaxForm((f) => ({ ...f, taxId: e.target.value }))}
                            maxLength={50}
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                          />
                        </label>
                        <label className="flex items-center gap-2 sm:mt-6">
                          <input
                            type="checkbox"
                            checked={taxForm.isTaxExempt}
                            onChange={(e) =>
                              setTaxForm((f) => ({ ...f, isTaxExempt: e.target.checked }))
                            }
                            className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                          />
                          <span className="text-sm text-gray-700">Tax-exempt</span>
                        </label>
                        {taxForm.isTaxExempt && (
                          <label className="block sm:col-span-2">
                            <span className="mb-1 block text-xs font-medium text-gray-600">
                              Exemption ref
                            </span>
                            <input
                              value={taxForm.taxExemptionRef}
                              onChange={(e) =>
                                setTaxForm((f) => ({ ...f, taxExemptionRef: e.target.value }))
                              }
                              maxLength={100}
                              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                            />
                          </label>
                        )}
                      </div>
                      {taxError && <p className="text-xs text-red-600">{taxError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveTaxInfo}
                          disabled={savingTax}
                          className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
                        >
                          {savingTax && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelTaxEdit}
                          disabled={savingTax}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">Tax ID (TIN)</p>
                        <p className="mt-0.5 font-medium text-gray-800">{customer.taxId || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tax-exempt</p>
                        <p className="mt-0.5 font-medium text-gray-800">
                          {customer.isTaxExempt ? 'Yes' : 'No'}
                        </p>
                      </div>
                      {customer.isTaxExempt && (
                        <div>
                          <p className="text-xs text-gray-500">Exemption ref</p>
                          <p className="mt-0.5 font-medium text-gray-800">
                            {customer.taxExemptionRef || '—'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">Totals</h2>
              <div
                className={`grid grid-cols-2 gap-3 border-t border-gray-100 p-4 pt-3 ${
                  ledger.totals.totalFinanced > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'
                }`}
              >
                <TotalStat label="Total Billed" value={fmtMoney(ledger.totals.totalBilled)} />
                <TotalStat label="Total Paid" value={fmtMoney(ledger.totals.totalPaid)} />
                <TotalStat label="Total Rebates" value={fmtMoney(ledger.totals.totalRebates)} />
                {/* Settled by a TPF partner, not by the customer — shown only
                    when there is any, so a customer with no TPF purchase keeps
                    the original four-stat row. */}
                {ledger.totals.totalFinanced > 0 && (
                  <TotalStat label="Financed (TPF)" value={fmtMoney(ledger.totals.totalFinanced)} />
                )}
                <TotalStat label="Outstanding" value={fmtMoney(ledger.totals.outstanding)} bold />
              </div>
            </section>

            {ledger.items.length > 0 && (
              <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">
                  Items Purchased
                </h2>
                <table className="w-full border-collapse border-t border-gray-100 text-[13px]">
                  <tbody className="divide-y divide-gray-100">
                    {ledger.items.map((item, i) => (
                      <tr key={i}>
                        <td className="w-32 px-4 py-2 text-gray-500">{fmtDate(item.date)}</td>
                        <td className="w-48 px-4 py-2 font-mono text-xs text-gray-500">
                          {item.ref}
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-800">{item.itemLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h2 className="border-b border-gray-100 p-4 pb-2 text-[14px] font-semibold text-gray-900">
                Ledger
              </h2>
              {ledger.rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">No ledger activity yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="border-r border-gray-100 px-4 py-1.5">Date</th>
                        <th className="border-r border-gray-100 px-4 py-1.5">Ref</th>
                        <th className="border-r border-gray-100 px-4 py-1.5 text-right">Inst.</th>
                        <th className="border-r border-gray-100 px-4 py-1.5">Description</th>
                        <th className="border-r border-gray-100 px-4 py-1.5 text-right">Debit</th>
                        <th className="border-r border-gray-100 px-4 py-1.5 text-right">Credit</th>
                        <th className="border-r border-gray-100 px-4 py-1.5 text-right">Due</th>
                        <th className="px-4 py-1.5 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledger.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5 text-gray-600">
                            {fmtDate(row.date)}
                          </td>
                          <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5 font-mono text-xs text-gray-500">
                            {row.ref}
                          </td>
                          <td className="border-r border-gray-100 px-4 py-1.5 text-right text-gray-500">
                            {row.inst > 0 ? row.inst : '—'}
                          </td>
                          <td className="border-r border-gray-100 px-4 py-1.5 text-gray-800">
                            {row.description}
                          </td>
                          <td className="border-r border-gray-100 px-4 py-1.5 text-right text-gray-800">
                            {row.debit > 0 ? fmtMoney(row.debit) : '—'}
                          </td>
                          <td className="border-r border-gray-100 px-4 py-1.5 text-right text-gray-800">
                            {row.credit > 0 ? fmtMoney(row.credit) : '—'}
                          </td>
                          <td
                            className={`border-r border-gray-100 px-4 py-1.5 text-right ${row.due < 0 ? 'text-red-600' : 'text-gray-800'}`}
                          >
                            {fmtMoney(row.due)}
                          </td>
                          <td className="px-4 py-1.5 text-right font-semibold text-gray-900">
                            {fmtMoney(row.outstanding)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50 text-[13px] font-semibold text-gray-900">
                        <td className="border-r border-gray-100 px-4 py-1.5" colSpan={4}>
                          Total
                        </td>
                        <td className="border-r border-gray-100 px-4 py-1.5 text-right">
                          {fmtMoney(ledger.rows.reduce((sum, r) => sum + r.debit, 0))}
                        </td>
                        <td className="border-r border-gray-100 px-4 py-1.5 text-right">
                          {fmtMoney(ledger.rows.reduce((sum, r) => sum + r.credit, 0))}
                        </td>
                        <td className="border-r border-gray-100 px-4 py-1.5" />
                        <td className="px-4 py-1.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

/** Sales Invoice No. first — that's what someone picking a transaction is
 * holding — then what was bought, then how it was sold. */
function transactionOptionLabel(tx: CustomerLedgerTransaction): string {
  const parts = [`${tx.ref} — ${tx.label}`]
  if (tx.termMonths) parts.push(`${tx.termMonths}mo`)
  if (tx.status) parts.push(tx.status)
  parts.push(TRANSACTION_KIND_LABELS[tx.kind])
  return parts.join(' · ')
}

const TRANSACTION_KIND_LABELS: Record<CustomerLedgerTransaction['kind'], string> = {
  inhouse: 'installment',
  tpf: 'TPF',
  cash: 'cash',
  charge: 'charge',
}

function TotalStat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`mt-0.5 ${bold ? 'text-lg font-bold text-gray-900' : 'font-medium text-gray-800'}`}
      >
        {value}
      </p>
    </div>
  )
}
