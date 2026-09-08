'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Pencil, Printer } from 'lucide-react'
import { Expenses, fmtMoney, type ExpenseDocument } from '@/src/libs/data/AccountingV2Data'
import { printExpenseVoucherDocument } from '@/src/libs/print/printInventoryDocument'

// Mirrors ExpensesList's own STATUS_STYLES — kept local rather than imported
// so this page doesn't pull in that list's client tree just for a 3-entry map.
const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECORDED: 'bg-emerald-50 text-emerald-700',
  VOID: 'bg-red-50 text-red-600',
}

const PAYEE_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  EMPLOYEE: 'Employee',
  OTHER: 'Other',
}

const CLEARED_LABELS: Record<string, string> = {
  SAME_DATE: 'On the same date',
  LATER_DATE: 'On a later date',
}

// Matches ExpenseForm's TAX_CODE_OPTIONS — 'VAT' is stored, "Input VAT" is
// shown, since VAT on a purchase is the claimable kind.
const TAX_CODE_LABELS: Record<string, string> = {
  VAT: 'Input VAT',
  NON_VAT: 'Non-VAT',
  EXEMPT: 'Exempt',
}

/** MM/DD/YYYY — the format the form's date inputs and the printed voucher use. */
function fmtDoc(v: string | null | undefined): string {
  return v
    ? new Date(v).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      })
    : '—'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 text-[13px] text-prominent-purple-900">{children}</p>
    </div>
  )
}

export default function ExpenseDetail({ id }: { id: string }) {
  const [doc, setDoc] = useState<ExpenseDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // The document envelope is a superset of GET /expenses/:id — it resolves
    // the weak cross-module ids (item, supplier invoice, bank) into names and
    // adds the enterprise letterhead — so one fetch backs both this view and
    // the Print button.
    Expenses.getDocument(id).then((res) => {
      if (res.success && res.data) setDoc(res.data)
      else setError(res.error ?? 'Expense not found')
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading expense…
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/accounting/expenses"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Expenses
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const e = doc.document
  // Item/Qty/Unit price only ever apply to a Supplier entry (see the form's
  // ITEM_MODE_GRID_COLS) — every other payee type records account + amount
  // alone, so those columns are dropped rather than printed as three dashes.
  const itemMode = e.lines.some((l) => l.item || l.qty != null || l.unitPrice != null)
  // Recipient varies per line only for Other → Special Accounts; every other
  // payee type fixes it at the header, where it's already shown.
  const perLinePayee = e.lines.some((l) => l.lineEmployee || l.linePayee)
  const showTax = e.taxAmount > 0

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/accounting/expenses"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Expenses
        </Link>
        <div className="flex items-center gap-2">
          {e.status === 'DRAFT' && (
            <Link
              href={`/accounting/expenses/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-purple-700 shadow-sm hover:bg-purple-50"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )}
          <button
            onClick={() => printExpenseVoucherDocument(doc)}
            className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
          >
            <Printer className="h-4 w-4" /> Print voucher
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[19px] font-bold text-prominent-purple-900">
          {e.voucherNumber || e.expenseNumber}
        </h1>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[e.status] ?? 'bg-purple-50 text-purple-700'}`}
        >
          {e.status}
        </span>
        {e.voucherNumber && (
          <span className="font-mono text-[12px] text-gray-500">{e.expenseNumber}</span>
        )}
      </div>

      <section className="mt-3 rounded-lg border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Payee">
            {e.payee ?? '—'}
            {e.payeeType && (
              <span className="text-gray-500">
                {' '}
                · {PAYEE_TYPE_LABELS[e.payeeType] ?? e.payeeType}
                {e.otherCategory ? ` / ${e.otherCategory.replace(/_/g, ' ').toLowerCase()}` : ''}
              </span>
            )}
          </Field>
          <Field label="Date">{fmtDoc(e.expenseDate)}</Field>
          <Field label="Cleared">
            {e.clearedType ? (CLEARED_LABELS[e.clearedType] ?? e.clearedType) : '—'}
            {e.clearedDate && <span className="text-gray-500"> · {fmtDoc(e.clearedDate)}</span>}
          </Field>
          <Field label="Total">
            <span className="font-semibold tabular-nums">{fmtMoney(e.totalAmount)}</span>
          </Field>
          {e.payeeAddress && <Field label="Address">{e.payeeAddress}</Field>}
          {e.payeeTin && <Field label="Payee's TIN">{e.payeeTin}</Field>}
          {e.paidFor.length > 0 && <Field label="Supplier invoices">{e.paidFor.join(', ')}</Field>}
          {e.costCenter && <Field label="Cost center">{e.costCenter}</Field>}
          {e.description && <Field label="Description">{e.description}</Field>}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-prominent-purple-900">Lines</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-[13px]">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                {itemMode && <th className="py-2 pr-4">Item</th>}
                {perLinePayee && <th className="py-2 pr-4">Recipient</th>}
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Description</th>
                {itemMode && <th className="py-2 pr-4">SI</th>}
                {itemMode && <th className="py-2 pr-4 text-right">Qty</th>}
                {itemMode && <th className="py-2 pr-4 text-right">Unit price</th>}
                {showTax && <th className="py-2 pr-4 text-right">Tax</th>}
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {e.lines.map((l, i) => (
                <tr key={i}>
                  {itemMode && <td className="py-2 pr-4 text-gray-900">{l.item ?? '—'}</td>}
                  {perLinePayee && (
                    <td className="py-2 pr-4 text-gray-900">
                      {l.lineEmployee ?? l.linePayee ?? '—'}
                    </td>
                  )}
                  <td className="py-2 pr-4 text-gray-900">{l.account ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-600">{l.description || '—'}</td>
                  {itemMode && (
                    <td className="py-2 pr-4 font-mono text-[12px] text-gray-600">
                      {l.siNumber ?? '—'}
                    </td>
                  )}
                  {itemMode && (
                    <td className="py-2 pr-4 text-right tabular-nums">{l.qty ?? '—'}</td>
                  )}
                  {itemMode && (
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {l.unitPrice != null ? fmtMoney(l.unitPrice) : '—'}
                    </td>
                  )}
                  {showTax && (
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtMoney(l.taxAmount)}
                      {l.taxCode && (
                        <span className="ml-1 text-[11px] text-gray-400">
                          {TAX_CODE_LABELS[l.taxCode] ?? l.taxCode}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="py-2 text-right tabular-nums">{fmtMoney(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-6 text-[13px]">
          <span className="text-gray-500">
            Subtotal <span className="tabular-nums text-gray-800">{fmtMoney(e.subtotal)}</span>
          </span>
          {showTax && (
            <span className="text-gray-500">
              Tax <span className="tabular-nums text-gray-800">{fmtMoney(e.taxAmount)}</span>
            </span>
          )}
          <span className="font-semibold text-prominent-purple-900">
            Total <span className="tabular-nums">{fmtMoney(e.totalAmount)}</span>
          </span>
        </div>
      </section>

      {/* One entry can be settled through several methods at once, each with
          its own reference and amount — the list only has room for the first. */}
      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-prominent-purple-900">Payment</h2>
        {e.payments.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-gray-400">No payment methods recorded.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {e.payments.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <span className="text-gray-800">{p.paymentMethod.replace(/_/g, ' ')}</span>
                  {p.bankAccount && <span className="text-gray-500"> · {p.bankAccount}</span>}
                  {p.reference && <span className="text-gray-500"> · {p.reference}</span>}
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                  {fmtMoney(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {e.journalEntryId && (
          <p className="mt-3 text-[12px] text-gray-500">
            Posted to the GL ·{' '}
            <Link
              href={`/accounting/journal-entries/${e.journalEntryId}`}
              className="text-purple-600 hover:underline"
            >
              view journal entry
            </Link>
          </p>
        )}
      </section>
    </div>
  )
}
