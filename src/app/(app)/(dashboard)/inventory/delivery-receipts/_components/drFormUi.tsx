import type { ReactNode } from 'react'
import { MONO, PLEX } from '@/src/libs/design/plex'

// Small layout pieces shared by the Delivery Receipt form's sections — the
// card shell and the label/control/error stack, in the receive screens' own
// palette (see purchase-orders/_components/receive-po/receiveTokens.ts).

export { PANEL, INPUT, INPUT_BAD } from '../../purchase-orders/_components/receive-po/receiveTokens'

export const TEXTAREA =
  'min-h-[76px] w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-[13px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

export const READONLY =
  'flex h-[38px] w-full items-center truncate whitespace-nowrap rounded-lg border border-[#e4e4e9] bg-[#f6f6f8] px-3 text-[13px] text-[#8b8b9b]'

export function Section({
  title,
  description,
  aside,
  children,
}: {
  title: ReactNode
  description?: string
  aside?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className="rounded-xl border border-[#e4e4e9] bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-[#eeeef1] px-5 py-3.5">
        <div>
          <h2 className="text-[13.5px] font-semibold text-[#17171c]">{title}</h2>
          {description && <p className="mt-0.5 text-[11.5px] text-[#8b8b9b]">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="flex flex-col gap-4 px-5 py-4">{children}</div>
    </section>
  )
}

export function Field({
  label,
  required,
  error,
  className = '',
  children,
}: {
  label: string
  required?: boolean
  error?: string
  className?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[12px] font-medium text-[#3d3d4a]">
        {label}
        {required && <span className="text-[#b42318]"> *</span>}
      </span>
      {children}
      {error && <FieldError text={error} />}
    </div>
  )
}

export function FieldError({ text }: { text: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-[#b42318]">
      <span className="inline-block h-[5px] w-[5px] rounded-full bg-[#b42318]" />
      {text}
    </span>
  )
}

/**
 * The full-screen document shell the Debit Memo, PO, transfer and UDS forms
 * use: `absolute inset-0` inside the app layout's relative <main>, so the
 * sidebar and top bar stay reachable. Fixed header, scrolling body, sticky
 * action bar.
 */
export function DrShell({
  title,
  chip,
  subtitle,
  headerAside,
  status,
  actions,
  children,
}: {
  title: string
  /** DR number badge beside the title, once there is one. */
  chip?: ReactNode
  subtitle: string
  /** Right side of the header — a headline figure. */
  headerAside?: ReactNode
  /** Left side of the action bar — one line on where the document stands. */
  status?: ReactNode
  actions: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className={`absolute inset-0 z-50 flex flex-col bg-[#f7f7f8] ${PLEX}`}>
      <div className="flex-none border-b border-[#e4e4e9] bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-[#17171c]">{title}</h2>
              {chip}
            </div>
            <p className="mt-1 text-xs text-[#5b5b6b]">{subtitle}</p>
          </div>
          {headerAside}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto max-w-[1400px] space-y-4">{children}</div>
      </div>
      <div className="flex-none border-t border-[#e4e4e9] bg-white px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(20,20,30,.35)] md:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-[11.5px] text-[#5b5b6b]">{status}</div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
    </div>
  )
}

export function NumberChip({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <span
      className={`${MONO} rounded-md bg-[#f1ebfb] px-2.5 py-1 text-[11.5px] font-medium text-[#3f1490]`}
    >
      {children}
    </span>
  )
}

/** Headline figure for the header's right side. */
export function HeaderFigure({
  label,
  value,
}: {
  label: string
  value: string
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
      <span className="text-[11px] text-[#5b5b6b]">{label}</span>
      <span className={`${MONO} text-xl font-semibold tracking-tight text-[#17171c]`}>{value}</span>
    </div>
  )
}

export const BTN_GHOST =
  'rounded-lg px-4 py-2.5 text-sm font-medium text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c] disabled:opacity-50'
export const BTN_SECONDARY =
  'flex items-center gap-2 rounded-lg border border-[#d3d3db] bg-white px-4 py-2.5 text-sm font-medium text-[#17171c] hover:bg-[#fbfbfc] disabled:opacity-50'
export const BTN_PRIMARY =
  'flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4a189b] disabled:opacity-50'
