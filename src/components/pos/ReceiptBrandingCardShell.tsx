'use client'

import type { LucideIcon } from 'lucide-react'
import { Loader2, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon: LucideIcon
  label: string
  editing: boolean
  loading?: boolean
  onEdit: () => void
  children: ReactNode
}

export function ReceiptBrandingCardShell({
  icon: Icon,
  label,
  editing,
  loading,
  onEdit,
  children,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <Icon size={14} />
          {label}
        </div>
        {!editing && (
          <button
            onClick={onEdit}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Pencil size={12} />
            Edit
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin text-purple-500" />
        </div>
      ) : (
        children
      )}
    </div>
  )
}
