'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import Tooltip from '@/src/components/ui/Tooltip'

export default function CopySerialButton({
  serialNumber,
}: {
  serialNumber: string
}): React.ReactElement {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await navigator.clipboard?.writeText(serialNumber)
    showToast({ title: `${serialNumber} copied`, status: 'success' })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip label={copied ? 'Copied' : 'Copy serial number'}>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy serial number"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#a3a3b2] hover:bg-[#f1ebfb] hover:text-[#3f1490]"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </Tooltip>
  )
}
