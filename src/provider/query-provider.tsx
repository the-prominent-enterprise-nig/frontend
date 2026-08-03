'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

// apiClient() gives every request a 30s AbortSignal.timeout and folds a
// timeout into a normal `{success: false, message: '...aborted due to
// timeout'}` return — most query hooks then do
// `if (!result.success) throw new Error(result.message ?? '...')`, which is
// what actually triggers React Query's retry. Retrying a request that
// already burned 30s almost never helps (the endpoint is slow, not
// flaky) and previously stacked into 60-90s of total wait on a single
// slow navigation. Skip retries specifically for that case; keep normal
// retry behavior for everything else (transient network errors, 5xxs).
function shouldRetry(failureCount: number, error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/timed? ?out|aborted/i.test(message)) return false
  return failureCount < 2
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            refetchOnWindowFocus: false,
            retry: shouldRetry,
          },
          mutations: {
            retry: shouldRetry,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
