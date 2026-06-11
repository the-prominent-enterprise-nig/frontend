'use client'

type Props = {
  id: string
  showBackButton?: boolean
  showRefreshButton?: boolean
  visibleSections?: string[]
}

export function EmployeeDetailShell({ id }: Props) {
  return (
    <div className="px-6 py-8 text-center text-sm text-zinc-400">
      Employee profile ({id}) coming soon.
    </div>
  )
}
