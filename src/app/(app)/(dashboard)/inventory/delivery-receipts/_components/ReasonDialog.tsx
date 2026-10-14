'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/src/components/ui/Modal'
import { BTN_SECONDARY, TEXTAREA } from './drFormUi'

/** A destructive action that has to say why — void a DR, void a memo. The
 * confirm button stays disabled until a reason is typed. */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  /** Resolves true when done, so the dialog can close itself. */
  onConfirm: (reason: string) => Promise<boolean>
  onClose: () => void
}): React.JSX.Element {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm(): Promise<void> {
    setBusy(true)
    const ok = await onConfirm(reason.trim())
    setBusy(false)
    if (ok) {
      setReason('')
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !reason.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#b42318] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#912018] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
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
          aria-label="Reason"
        />
      </label>
    </Modal>
  )
}
