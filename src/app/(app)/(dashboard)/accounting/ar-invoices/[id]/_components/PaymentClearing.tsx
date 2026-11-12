'use client'

import { useState, type ReactElement } from 'react'
import { ARInvoices, fmtDate, type ARPayment } from '@/src/libs/data/AccountingV2Data'
import ClearsBankField, {
  clearsBankPayload,
  type ClearsBankValue,
} from '@/src/components/accounting/ClearsBankField'

/** Whether the collection reached a bank at all — only then does it clear one. */
export function clearsABank(p: ARPayment): boolean {
  return !!p.bankAccountId && p.method !== 'CASH' && !p.cancelledAt
}

function statusText(p: ARPayment): string {
  if (p.clearedType === 'LATER_DATE') {
    return p.clearedDate ? `Clears ${fmtDate(p.clearedDate)}` : 'Not cleared yet'
  }
  return `Clears ${fmtDate(p.clearedDate ?? p.paymentDate)} (same date)`
}

function initialValue(p: ARPayment): ClearsBankValue {
  return {
    clearedType: p.clearedType === 'LATER_DATE' ? 'LATER_DATE' : 'SAME_DATE',
    clearedDate: p.clearedDate ? p.clearedDate.slice(0, 10) : '',
  }
}

/**
 * When a bank collection clears — what Bank Reconciliation reads instead of a
 * tick. A cheque recorded "on a later date" gets its date here once the bank
 * has it. Locked once a completed reconciliation has matched the payment.
 */
export default function PaymentClearing({
  invoiceId,
  payment,
  canEdit,
  onSaved,
}: {
  invoiceId: string
  payment: ARPayment
  canEdit: boolean
  onSaved: (updated: ARPayment) => void
}): ReactElement {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<ClearsBankValue>(() => initialValue(payment))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = !!payment.clearedAt

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    const res = await ARInvoices.updatePayment(invoiceId, payment.id, clearsBankPayload(value))
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Could not save the cleared date')
      return
    }
    onSaved(res.data)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        <ClearsBankField
          id={`clears-${payment.id}`}
          value={value}
          onChange={setValue}
          minDate={payment.paymentDate.slice(0, 10)}
          disabled={saving}
        />
        {error && <p className="text-[12px] text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-[12px] text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-purple-700 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-1 flex items-center gap-2 px-1.5 text-[11px] text-gray-500">
      <span>Bank: {statusText(payment)}</span>
      {locked ? (
        <span className="text-gray-400">· matched in a completed bank reconciliation</span>
      ) : (
        canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-medium text-purple-700 hover:underline"
          >
            Change
          </button>
        )
      )}
    </div>
  )
}
