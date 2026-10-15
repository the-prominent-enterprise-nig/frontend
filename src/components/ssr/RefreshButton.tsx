'use client'

import { useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

/** Re-renders the current route's Server Components with fresh data. */
export function RefreshButton({
  label = 'Retry',
  className = 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50',
  showLabelOnMobile = true,
}: {
  label?: string
  className?: string
  showLabelOnMobile?: boolean
}): React.JSX.Element {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className={className}
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
      <span className={showLabelOnMobile ? '' : 'hidden sm:inline'}>{label}</span>
    </button>
  )
}
