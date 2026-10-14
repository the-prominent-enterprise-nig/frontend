'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import { deleteDeliveryReceipt } from '../_actions/delete-delivery-receipt'

export function DeleteDraftButton({
  id,
  drNumber,
}: {
  id: string
  drNumber: string
}): React.JSX.Element {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onConfirm(): Promise<void> {
    setLoading(true)
    const res = await deleteDeliveryReceipt(id)
    setLoading(false)
    if (!res.success) {
      showToast({ title: res.message ?? 'Failed to delete the draft', status: 'error' })
      return
    }
    setOpen(false)
    showToast({ title: `${drNumber} deleted`, status: 'success' })
    await queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] })
    router.push('/inventory/stock-transaction?tab=delivery-receipts')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-[#b42318] hover:bg-[#fdeceb]"
      >
        <Trash2 className="h-4 w-4" />
        Delete draft
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete ${drNumber}?`}
        message="The draft never touched stock, so nothing else changes. Its DR number is not reused."
        confirmLabel="Delete draft"
        destructive
        loading={loading}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
