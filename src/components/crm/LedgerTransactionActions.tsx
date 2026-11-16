'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { useMe } from '@/src/hooks/useMe'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { RECORDED_SALES_EDIT } from '@/src/libs/guards/explicit-only-permissions'
import { customersApi } from '@/src/libs/api/crm'
import { showToast } from '@/src/components/ui/toast'
import type { CustomerLedgerTransaction } from '@/src/schema/crm/types'
import { LEDGER_ACTION, LEDGER_CARD } from './LedgerParts'

const MAX_REASON = 500

/** Edit and Delete for the one live transaction the ledger is narrowed to
 * (Docket #46: "As a Business Owner, I should be able to edit or delete a live
 * transaction on the Customer Ledger"). Branch Managers and every other role
 * see neither.
 *
 * Both are read with can(), the check the server applies: they ride on the
 * explicit-only crm:installment-accounts:update / :delete permissions (a CRM
 * wildcard never grants them), so a Cashier's or Branch Manager's `crm:*:*`
 * must not show a button the server then refuses (the #44 lesson).
 *
 * "Live" is a transaction with a POS sale of its own (`saleId`). An account
 * loaded from the aging sheet or entered by hand has none, so it offers
 * neither.
 *
 * Edit opens what already edits the transaction: an installment plan's Edit
 * sits in the plan's own header, so only the other kinds get one here, and
 * it opens the sale, where its Edit entry (agent, credit, commission, SMI and
 * invoice date) already lives. Delete is the sale's Void with a reason: a flat
 * panel on the page, not a dialog. */
export default function LedgerTransactionActions({
  transaction,
  onDeleted,
}: {
  transaction: CustomerLedgerTransaction
  onDeleted: () => void
}) {
  const { data: me } = useMe()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saleId = transaction.saleId
  if (!saleId || !me) return null
  const canDelete = can(me, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_DELETE)
  const canEdit =
    transaction.kind !== 'inhouse' &&
    can(me, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_UPDATE) &&
    can(me, RECORDED_SALES_EDIT)
  if (!canDelete && !canEdit) return null

  async function confirmDelete(): Promise<void> {
    if (!saleId) return
    const why = reason.trim()
    if (!why) return setError('Say why this transaction is being deleted.')
    setBusy(true)
    setError(null)
    const res = await customersApi.deleteLedgerTransaction(saleId, why)
    setBusy(false)
    if (!res.success) {
      return setError(readable(res.message || res.error || 'Could not delete the transaction.'))
    }
    showToast({ title: 'Transaction deleted', status: 'success' })
    setOpen(false)
    setReason('')
    onDeleted()
  }

  return (
    <div className="mb-4" data-testid="ledger-transaction-actions">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canEdit && (
          <Link
            href={`/pos/transactions?id=${encodeURIComponent(saleId)}`}
            className={LEDGER_ACTION}
            data-testid="ledger-transaction-edit"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        )}
        {canDelete && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${LEDGER_ACTION} text-red-700`}
            data-testid="ledger-transaction-delete"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>

      {canDelete && open && (
        <section
          className={`${LEDGER_CARD} mt-3 border-red-200 p-4`}
          data-testid="ledger-delete-panel"
        >
          <h2 className="text-[14px] font-semibold text-prominent-purple-900">
            Delete {transaction.ref}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
            The sale is voided: the entries it posted are reversed, its stock goes back, and it
            leaves this ledger. A sale that has taken a payment cannot be deleted until its payments
            are cancelled, and a sale rung up today goes through a void request. This cannot be
            undone.
          </p>
          <label className="mt-3 block text-[13px] font-medium text-gray-700" htmlFor="delete-why">
            Reason <span className="text-red-600">*</span>
          </label>
          <textarea
            id="delete-why"
            value={reason}
            maxLength={MAX_REASON}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this transaction being deleted?"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-prominent-purple-400 focus:outline-none"
            data-testid="ledger-delete-reason"
          />
          {error && (
            <p
              role="alert"
              className="mt-2 text-[13px] text-red-700"
              data-testid="ledger-delete-error"
            >
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => void confirmDelete()}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="ledger-delete-confirm"
            >
              {busy ? 'Deleting…' : 'Delete transaction'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              className={LEDGER_ACTION}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

/** The server's refusals read as `code: sentence` or a bare sentence; show the
 * sentence. */
function readable(message: string): string {
  const [code, ...rest] = message.split(': ')
  return rest.length > 0 && /^[a-z_]+$/.test(code) ? rest.join(': ') : message
}
