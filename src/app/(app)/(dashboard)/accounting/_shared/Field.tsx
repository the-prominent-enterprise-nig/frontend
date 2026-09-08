'use client'

import type { ReactNode } from 'react'

/** The stacked label + control used by every dialog in Accounting. Lived in
 * ARInvoicesList until the memo dialogs moved out and needed it too. */
export default function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}
