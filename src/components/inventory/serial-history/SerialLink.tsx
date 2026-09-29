'use client'

import type { ReactNode } from 'react'
import { useUIShell } from '@/src/stores/ui-shell.store'

/**
 * A serial number that opens its own history panel. Used wherever a serial is
 * shown, so "where has this unit been?" is one click from any screen rather
 * than a detour through the item it belongs to.
 */
export default function SerialLink({
  serialId,
  serialNumber,
  className = '',
  children,
}: {
  serialId: string
  serialNumber: string
  className?: string
  children?: ReactNode
}) {
  const { pushPanel } = useUIShell()

  return (
    <button
      type="button"
      data-testid="serial-link"
      onClick={(e) => {
        // Rows that hold a link often have their own click (select, expand).
        e.stopPropagation()
        pushPanel({ type: 'serial', serialId, serialNumber })
      }}
      className={`text-left underline decoration-[#c9b8ee] decoration-dotted underline-offset-2 hover:text-[#5b21b6] hover:decoration-[#5b21b6] ${className}`}
    >
      {children ?? serialNumber}
    </button>
  )
}
