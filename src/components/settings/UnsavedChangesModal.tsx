'use client'

import { AlertTriangle } from 'lucide-react'

type UnsavedChangesModalProps = {
  message: string
  onKeepEditing: () => void
  onLeave: () => void
}

/** Shared by Manage Access and Create Role — see useUnsavedChangesGuard for why. */
export default function UnsavedChangesModal({
  message,
  onKeepEditing,
  onLeave,
}: UnsavedChangesModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Unsaved changes</h2>
            <p className="mt-1 text-sm text-zinc-500">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onKeepEditing}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700"
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  )
}
