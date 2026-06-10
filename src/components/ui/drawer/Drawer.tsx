'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

type DrawerProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

const WIDTHS = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-[560px]',
  lg: 'w-full max-w-[760px]',
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
  footer,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (typeof window === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${WIDTHS[width]} ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && <div className="shrink-0 border-t border-zinc-200 px-5 py-4">{footer}</div>}
      </div>
    </>,
    document.body
  )
}
