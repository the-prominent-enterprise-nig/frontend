'use client'

import { useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import type { ApiResponse } from '@/src/libs/api/client'
import type { PrintDocumentEnvelope } from '@/src/libs/print/printInventoryDocument'
import { BTN_SECONDARY } from './drFormUi'

/** Fetches a document's print envelope and opens it in a print window. */
export function PrintButton({
  load,
  print,
  label = 'Print',
}: {
  load: () => Promise<ApiResponse<PrintDocumentEnvelope>>
  print: (doc: PrintDocumentEnvelope) => void
  label?: string
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  async function onClick(): Promise<void> {
    setBusy(true)
    const res = await load()
    setBusy(false)
    if (!res.success || !res.data) {
      showToast({ title: res.error ?? 'Could not load the document', status: 'error' })
      return
    }
    print(res.data)
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className={BTN_SECONDARY}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      {label}
    </button>
  )
}
