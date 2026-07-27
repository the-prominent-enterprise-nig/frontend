'use client'

import { useState } from 'react'
import { X, Wrench } from 'lucide-react'
import { TechnicianSearchCombobox } from './TechnicianSearchCombobox'
import type { StartInstallFormValues } from '@/src/schema/pos/service-drafts'

type Props = {
  open: boolean
  onClose: () => void
  draftId: string | null
  draftTitle?: string
  onConfirm: (id: string, data: StartInstallFormValues) => Promise<unknown>
  isConfirming?: boolean
}

// Closing Gap 4 — assigns a technician and moves the job sourcing -> installing.
export function ServiceJobStartInstallModal({
  open,
  onClose,
  draftId,
  draftTitle,
  onConfirm,
  isConfirming,
}: Props) {
  const [technicianId, setTechnicianId] = useState('')

  if (!open) return null

  async function handleConfirm() {
    if (!draftId || !technicianId) return
    await onConfirm(draftId, { technicianId })
    setTechnicianId('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-prominent-purple-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Start Install</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          {draftTitle && <p className="mb-3 text-sm text-zinc-500">{draftTitle}</p>}

          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Technician <span className="text-red-500">*</span>
          </label>
          <TechnicianSearchCombobox value={technicianId} onChange={setTechnicianId} />
          <p className="mt-2 text-xs text-zinc-500">
            Assigns who&apos;s performing the install and moves this job to Installing.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!technicianId || isConfirming}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            {isConfirming ? 'Starting…' : 'Confirm & Start Install'}
          </button>
        </div>
      </div>
    </div>
  )
}
