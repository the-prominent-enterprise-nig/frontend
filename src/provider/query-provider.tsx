'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { ReactNode } from 'react'
import { getQueryClient } from '@/src/libs/query/get-query-client'

export function QueryProvider({ children }: { children: ReactNode }) {
  // Not useState: during the initial render React may discard state if
  // something below suspends, which would throw away the hydrated cache. The
  // browser gets one module-level client; the server a fresh one per request
  // (see get-query-client.ts).
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
