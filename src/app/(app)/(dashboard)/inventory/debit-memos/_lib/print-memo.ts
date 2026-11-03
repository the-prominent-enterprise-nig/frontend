import { showToast } from '@/src/components/ui/toast'
import { printDebitMemo } from '@/src/libs/print/printDeliveryReceipt'
import { getMemoDocument } from '../_actions/get-memo-document'

/** Fetches a memo's print envelope and opens the client's Debit memo form. */
export async function printMemo(kind: 'supplier' | 'internal', id: string): Promise<void> {
  const res = await getMemoDocument(kind, id)
  if (!res.success || !res.data) {
    showToast({ title: res.error ?? 'Could not load the debit memo', status: 'error' })
    return
  }
  printDebitMemo(res.data)
}
