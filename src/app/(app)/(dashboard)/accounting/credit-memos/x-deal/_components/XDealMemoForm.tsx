'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Handshake, Loader2 } from 'lucide-react'
import { XDealMemos, fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { showToast } from '@/src/components/ui/toast'
import Field from '../../../_shared/Field'

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100'

const LIST_HREF = '/accounting/credit-memos'

/**
 * Scenario 67 — clears an X-Deal (barter) sale's whole remaining balance.
 * No amount and no item lines: the server works out the split, and the
 * figures shown here are its own preview of the exact JE it will post, so
 * what's confirmed is what's booked.
 */
export default function XDealMemoForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [posTransactionId, setPosTransactionId] = useState('')
  const [reason, setReason] = useState('')
  // Today in the Philippines, not UTC — before 8 AM the UTC date is still
  // yesterday, which would book the memo to the previous day (or month).
  const [memoDate, setMemoDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Never served from cache: right after a memo is issued (or voided) the
  // cached list would still offer the sale it just cleared.
  const candidatesQuery = useQuery({
    queryKey: ['x-deal-candidates'],
    queryFn: () => XDealMemos.candidates(),
    gcTime: 0,
  })
  const candidates = candidatesQuery.data?.data ?? []
  const selected = candidates.find((c) => c.posTransactionId === posTransactionId)

  const previewQuery = useQuery({
    queryKey: ['x-deal-preview', posTransactionId],
    queryFn: () => XDealMemos.preview(posTransactionId),
    enabled: !!posTransactionId,
  })
  const preview = previewQuery.data?.data

  async function handleIssue() {
    // A ref-free guard is enough: `saving` disables the button on the first
    // click's re-render, and the backend refuses a second memo anyway.
    if (saving || !posTransactionId) return
    setSaving(true)
    setError('')
    const res = await XDealMemos.issue({
      posTransactionId,
      reason: reason.trim() || undefined,
      memoDate,
    })
    if (!res.success || !res.data) {
      setSaving(false)
      setError(res.message || res.error || 'Could not issue the X-Deal memo.')
      return
    }
    showToast({
      title: `X-Deal memo ${res.data.memoNumber} issued`,
      description: `${selected?.customer.name ?? 'The account'} is settled at ₱0.00.`,
      status: 'success',
    })
    // The list caches for 30 s and is already cached from the way here, so
    // without this it would come back without the memo just issued.
    queryClient.invalidateQueries({ queryKey: ['customer-credit-memos'] })
    router.push(LIST_HREF)
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href={LIST_HREF}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Credit Memos
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-semibold text-prominent-purple-900">
        <Handshake className="h-6 w-6" />
        X-Deal offset
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Clears an X-Deal sale&apos;s whole remaining balance and closes its installment account at
        ₱0.00.
      </p>
      {/* Scenario 68 — every X-Deal issues this memo itself when the sale is
          approved, so only a sale whose memo was voided is listed here. */}
      <p className="mt-1 text-sm text-gray-500" data-testid="x-deal-offset-auto-note">
        X-Deal memos are now issued automatically when the sale is approved. Use this page only to
        re-issue one after its memo was voided.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <Field label="X-Deal sale *">
            <select
              aria-label="X-Deal sale"
              value={posTransactionId}
              onChange={(e) => {
                setPosTransactionId(e.target.value)
                setError('')
              }}
              disabled={candidatesQuery.isLoading}
              className={INPUT_CLASS}
            >
              <option value="">
                {candidatesQuery.isLoading
                  ? 'Loading…'
                  : candidates.length === 0
                    ? 'No X-Deal sales to re-issue'
                    : 'Select an X-Deal sale…'}
              </option>
              {candidates.map((c) => (
                <option key={c.posTransactionId} value={c.posTransactionId}>
                  {c.customer.name} · {c.salesInvoiceNumber ?? c.transactionNumber} ·{' '}
                  {c.xDealReference ?? 'no reference'} · {fmtMoney(c.outstanding)}
                </option>
              ))}
            </select>
          </Field>

          {selected && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs">
              <dt className="text-gray-500">X-Deal reference</dt>
              <dd className="text-gray-900">{selected.xDealReference ?? '—'}</dd>
              <dt className="text-gray-500">Sale date</dt>
              <dd className="text-gray-900">{fmtDate(selected.saleDate)}</dd>
              <dt className="text-gray-500">Installment account</dt>
              <dd className="font-mono text-gray-900">{selected.accountNumber}</dd>
              <dt className="text-gray-500">Invoice</dt>
              <dd className="font-mono text-gray-900">{selected.invoiceNumber}</dd>
              {selected.branchName && (
                <>
                  <dt className="text-gray-500">Branch</dt>
                  <dd className="text-gray-900">{selected.branchName}</dd>
                </>
              )}
            </dl>
          )}

          <Field label="Memo date">
            <input
              type="date"
              aria-label="Memo date"
              value={memoDate}
              onChange={(e) => setMemoDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="What was received (reason)">
            <input
              aria-label="Reason"
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Billboard space, Q4 2026"
              className={INPUT_CLASS}
            />
          </Field>
        </section>

        <section
          data-testid="x-deal-je-preview"
          className="rounded-xl border border-gray-200 bg-white p-5"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Journal entry
          </p>
          {!posTransactionId ? (
            <p className="text-sm text-gray-400">
              Pick an X-Deal sale to see the entry this memo will post.
            </p>
          ) : previewQuery.isLoading ? (
            <p className="flex items-center gap-1.5 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
            </p>
          ) : !preview ? (
            <p className="text-sm text-red-600">
              {previewQuery.data?.message ||
                previewQuery.data?.error ||
                'Could not calculate this X-Deal.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="py-1">Account</th>
                  <th className="py-1 text-right">Debit</th>
                  <th className="py-1 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.clearing > 0 && (
                  <tr>
                    <td className="py-1.5">1-01-140 Accounts Receivable - Others</td>
                    <td className="py-1.5 text-right tabular-nums" data-testid="je-clearing">
                      {fmtMoney(preview.clearing)}
                    </td>
                    <td />
                  </tr>
                )}
                {preview.unearnedInterest > 0 && (
                  <tr>
                    <td className="py-1.5">Unearned Interest Income</td>
                    <td className="py-1.5 text-right tabular-nums" data-testid="je-unearned">
                      {fmtMoney(preview.unearnedInterest)}
                    </td>
                    <td />
                  </tr>
                )}
                <tr>
                  <td className="py-1.5">Accounts Receivable</td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums" data-testid="je-ar">
                    {fmtMoney(preview.outstanding)}
                  </td>
                </tr>
                {preview.financingIncome > 0 && (
                  <tr>
                    <td className="py-1.5">Financing Income (already collected)</td>
                    <td />
                    <td className="py-1.5 text-right tabular-nums">
                      {fmtMoney(preview.financingIncome)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href={LIST_HREF}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleIssue}
          disabled={saving || !preview}
          className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-50"
        >
          {saving ? 'Issuing…' : 'Issue X-Deal memo'}
        </button>
      </div>
    </div>
  )
}
