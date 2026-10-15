'use client'

import { useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { printMemo } from '../_lib/print-memo'

/** Icon-only Print for a memo row, with the shared tooltip. */
export function PrintMemoIconButton({
  kind,
  id,
}: {
  kind: 'supplier' | 'internal'
  id: string
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  return (
    <Tooltip label="Print debit memo">
      <button
        type="button"
        aria-label="Print debit memo"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await printMemo(kind, id)
          setBusy(false)
        }}
        className="rounded-md p-1.5 text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#3f1490] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      </button>
    </Tooltip>
  )
}
