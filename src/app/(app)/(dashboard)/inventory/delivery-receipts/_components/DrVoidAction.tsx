'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import type { DrDetail } from '@/src/schema/inventory/delivery-receipts'
import { voidDeliveryReceipt } from '../_actions/decide-delivery-receipt'
import { BTN_GHOST } from './drFormUi'
import { ReasonDialog } from './ReasonDialog'

/** Void for an approved or posted DR (Branch Manager / Business Owner). */
export function DrVoidAction({ dr }: { dr: DrDetail }): React.JSX.Element {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  async function onVoid(reason: string): Promise<boolean> {
    const res = await voidDeliveryReceipt(dr.id, reason)
    if (!res.success) {
      showToast({ title: res.message ?? 'Failed to void', status: 'error' })
      return false
    }
    showToast({ title: `${dr.drNumber} voided`, status: 'success' })
    await queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] })
    router.refresh()
    return true
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={BTN_GHOST}>
        <span className="flex items-center gap-2 text-[#b42318]">
          <Ban className="h-4 w-4" />
          Void
        </span>
      </button>
      <ReasonDialog
        open={open}
        title={`Void ${dr.drNumber}?`}
        description={
          dr.status === 'posted'
            ? 'Its debit memo is voided, the journal entry reversed, and the units go back on the shelf.'
            : 'Nothing has posted yet. Its debit memo (if any) is voided and the held units go back on the shelf.'
        }
        confirmLabel="Void DR"
        onConfirm={onVoid}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
