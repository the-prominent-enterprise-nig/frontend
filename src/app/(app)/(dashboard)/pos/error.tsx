'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function PosError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[POS] Unhandled error:', error)
  }, [error])

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-zinc-50 p-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">Something went wrong</p>
          <p className="mt-1 text-sm text-gray-500">
            An unexpected error occurred in the POS module.
          </p>
          {error.message && (
            <p className="mt-2 rounded bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
              {error.message}
            </p>
          )}
        </div>
        <button
          onClick={reset}
          className="w-full rounded-xl bg-purple-700 py-3 text-center text-sm font-bold text-white hover:bg-purple-800"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
