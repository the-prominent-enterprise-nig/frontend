import type { ReactNode } from 'react'

interface Props {
  label: string
  badge?: ReactNode
  divider?: boolean
  children: ReactNode
}

export function ReceiptFieldRow({ label, badge, divider = true, children }: Props) {
  return (
    <>
      <div
        className={`flex items-center justify-between ${divider ? 'border-t border-gray-100 pt-4' : ''}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        {badge}
      </div>
      {children}
    </>
  )
}
