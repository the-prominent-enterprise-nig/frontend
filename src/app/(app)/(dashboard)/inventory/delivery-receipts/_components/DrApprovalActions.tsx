'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, X } from 'lucide-react'
import { ConfirmDialog, Modal } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import { DR_PURPOSE_CONFIG } from '@/src/libs/inventory/delivery-receipt-purposes'
import type { DrDetail } from '@/src/schema/inventory/delivery-receipts'
import { approveDeliveryReceipt, rejectDeliveryReceipt } from '../_actions/decide-delivery-receipt'
import { BTN_PRIMARY, BTN_SECONDARY, TEXTAREA } from './drFormUi'

/** What approving does, in the approver's terms, per purpose. */
function approveMessage(dr: DrDetail): string {
  if (DR_PURPOSE_CONFIG[dr.purpose].withDebitMemo) {
    return 'The debit memo posts with this approval: the units leave the branch and the journal entry is recorded.'
  }
  if (dr.purpose === 'sales_invoice_to_follow') {
    return 'The units are held for this customer. Nothing is posted until the sale is rung up at POS.'
  }
  return 'The units are held for this delivery.'
}

/** Scenario 72 Part 3 — Approve / Reject on a submitted DR (Branch Manager;
 * Business Owner passes every permission check). */
export function DrApprovalActions({ dr }: { dr: DrDetail }): React.JSX.Element {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function done(message: string): Promise<void> {
    showToast({ title: message, status: 'success' })
    await queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] })
    router.refresh()
  }

  async function onApprove(): Promise<void> {
    setBusy(true)
    const res = await approveDeliveryReceipt(dr.id)
    setBusy(false)
    setConfirming(false)
    if (!res.success) {
      showToast({ title: res.message ?? 'Failed to approve', status: 'error' })
      return
    }
    await done(`${dr.drNumber} approved`)
  }

  async function onReject(): Promise<void> {
    setBusy(true)
    const res = await rejectDeliveryReceipt(dr.id, reason)
    setBusy(false)
    if (!res.success) {
      showToast({ title: res.message ?? 'Failed to reject', status: 'error' })
      return
    }
    setRejecting(false)
    await done(`${dr.drNumber} rejected`)
  }

  return (
    <>
      <button type="button" onClick={() => setRejecting(true)} className={BTN_SECONDARY}>
        <X className="h-4 w-4" />
        Reject
      </button>
      <button type="button" onClick={() => setConfirming(true)} className={BTN_PRIMARY}>
        <Check className="h-4 w-4" />
        Approve
      </button>
      <ConfirmDialog
        open={confirming}
        title={`Approve ${dr.drNumber}?`}
        message={approveMessage(dr)}
        confirmLabel="Approve"
        loading={busy}
        onConfirm={onApprove}
        onCancel={() => setConfirming(false)}
      />
      <Modal
        open={rejecting}
        title={`Reject ${dr.drNumber}?`}
        description="Nothing has moved, so nothing is undone. The units are free for another DR."
        onClose={() => setRejecting(false)}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRejecting(false)} className={BTN_SECONDARY}>
              Cancel
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy || !reason.trim()}
              className="flex items-center gap-2 rounded-lg bg-[#b42318] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#912018] disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject
            </button>
          </div>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-[#3d3d4a]">
            Reason <span className="text-[#b42318]">*</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className={TEXTAREA}
            placeholder="Why is this DR rejected?"
            aria-label="Reason for rejecting"
          />
        </label>
      </Modal>
    </>
  )
}
