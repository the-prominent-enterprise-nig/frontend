'use client'

import { type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

// Scenario 29 PO-15 — a plain "are you sure?" confirm for actions that
// previously committed instantly with no confirmation at all (PR Submit, PO
// Approve, PO Send, PO Close). Deliberately lighter than CancelPoModal (no
// reason field) — that one collects real data alongside the confirmation,
// these four don't need to collect anything.
type Props = {
  open: boolean
  onClose: () => void
  title: string
  icon: ReactNode
  iconColorClass: string
  summary: ReactNode
  message: string
  confirmLabel: string
  confirmingLabel: string
  confirmButtonClass: string
  onConfirm: () => Promise<void>
  isConfirming?: boolean
}

export function ConfirmActionModal({
  open,
  onClose,
  title,
  icon,
  iconColorClass,
  summary,
  message,
  confirmLabel,
  confirmingLabel,
  confirmButtonClass,
  onConfirm,
  isConfirming,
}: Props) {
  if (!open) return null

  async function handleConfirm() {
    await onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className={iconColorClass}>{icon}</span>
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">{summary}</div>
          <p className="text-sm text-zinc-600">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${confirmButtonClass}`}
          >
            {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
            {isConfirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
