'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

/** A button (not a link) on purpose: it has always been one, and the e2e specs find it by that role. */
export function NewReceiptButton(): React.JSX.Element {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/accounting/ar-invoices/receipts/new')}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
    >
      <Plus className="w-4 h-4" /> New Receipt
    </button>
  )
}
