'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const RETRY_DELAY_MS = 4_000
const MAX_AUTO_RETRIES = 5

/**
 * Shown instead of the app shell when the session check could not reach the
 * backend. The user is still signed in — their cookie is untouched — so this
 * retries in place rather than sending them to /login.
 */
export default function SessionUnavailable() {
  const router = useRouter()
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (attempts >= MAX_AUTO_RETRIES) return
    const timer = setTimeout(() => {
      setAttempts((n) => n + 1)
      router.refresh()
    }, RETRY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [attempts, router])

  const gaveUp = attempts >= MAX_AUTO_RETRIES

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <main className="flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-prominent-purple-50">
          <RefreshCw
            className={`h-7 w-7 text-prominent-purple-700 ${gaveUp ? '' : 'animate-spin'}`}
          />
        </div>
        <h1 className="text-xl font-semibold text-prominent-purple-900">
          {gaveUp ? 'Still having trouble reaching the server' : 'Reconnecting…'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          You&apos;re still signed in. The server is taking longer than usual to respond
          {gaveUp ? '.' : ' — retrying automatically.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setAttempts(0)
            router.refresh()
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-prominent-purple-800"
        >
          Try again
        </button>
      </main>
    </div>
  )
}
