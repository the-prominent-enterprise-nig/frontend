'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

type DrawerProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  /** Sits under the title, in the same fixed header. */
  subtitle?: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
  /** Extra classes for the sliding panel — it portals to <body>, so a font
   *  or theme set on the calling page can't reach it any other way. */
  panelClassName?: string
  footer?: ReactNode
}

const WIDTHS = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-[560px]',
  lg: 'w-full max-w-[760px]',
  xl: 'w-full max-w-[880px]',
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'md',
  panelClassName = '',
  footer,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // `typeof window === 'undefined'` evaluates differently between the SSR
  // pass and the client's first hydration render, causing a hydration
  // mismatch as soon as this component mounts. Deferring the portal to a
  // post-mount effect keeps the server and initial client render both null.
  const [mounted, setMounted] = useState(false)
  // The panel stays mounted (translated off-screen) while closed so the
  // slide-out has something to animate — but that leaves its buttons/inputs
  // reachable by keyboard and screen readers, and matchable by any page-wide
  // accessibility query, for as long as it sits there. `inert` alone doesn't
  // reliably pull it out of every query surface (observed to still match via
  // getByRole in Chromium/Playwright despite being set), so this also delays
  // `visibility: hidden` until the close transition actually finishes —
  // visible immediately on open, hidden only `duration` after closing.
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      return
    }
    const timeout = setTimeout(() => setIsVisible(false), 300)
    return () => clearTimeout(timeout)
  }, [isOpen])

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

  if (!mounted) return null

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
        inert={!isOpen}
        className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${WIDTHS[width]} ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isVisible ? '' : 'invisible'} ${panelClassName}`}
      >
        {/* Header */}
        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
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
