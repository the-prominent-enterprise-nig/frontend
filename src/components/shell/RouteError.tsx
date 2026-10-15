'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

/**
 * Error boundary body for the signed-in app. A page throws here when the
 * session check could not reach the backend (SessionUnavailableError) or when
 * anything else in the route fails.
 *
 * "Try again" has to refresh the router as well as reset the boundary: reset()
 * alone only re-renders the client tree, so a failed server component would
 * never be asked again.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    console.error('[app] route error:', error)
  }, [error])

  const retry = () =>
    startTransition(() => {
      router.refresh()
      reset()
    })

  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-prominent-purple-50">
          <RefreshCw
            className={`h-7 w-7 text-prominent-purple-700 ${pending ? 'animate-spin' : ''}`}
          />
        </div>
        <h1 className="text-xl font-semibold text-prominent-purple-900">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          The server may be busy. You&apos;re still signed in — try again.
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={pending}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-prominent-purple-800 disabled:opacity-60"
        >
          {pending ? 'Trying again…' : 'Try again'}
        </button>
        {error.digest && <p className="mt-4 text-xs text-gray-400">Reference: {error.digest}</p>}
      </div>
    </div>
  )
}
