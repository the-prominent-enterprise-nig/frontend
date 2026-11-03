'use client'

import { useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { printDeliveryReceipt } from '@/src/libs/print/printDeliveryReceipt'
import { getDeliveryReceiptPrint } from '../_actions/get-delivery-receipt-document'
import { BTN_SECONDARY } from './drFormUi'

/** The DR's only Print: the Delivery Receipt, and its debit memo on the
 * next page when it has one. */
export function DrPrintButton({
  id,
  hasMemo,
}: {
  id: string
  hasMemo: boolean
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  async function onClick(): Promise<void> {
    setBusy(true)
    const res = await getDeliveryReceiptPrint(id, hasMemo)
    setBusy(false)
    if (!res.success || !res.data) {
      showToast({ title: res.error ?? 'Could not load the document', status: 'error' })
      return
    }
    printDeliveryReceipt(res.data.dr, res.data.memo)
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className={BTN_SECONDARY}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      Print
    </button>
  )
}
