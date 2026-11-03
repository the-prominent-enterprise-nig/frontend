import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query'

// apiClient() gives every request a 30s AbortSignal.timeout and folds a
// timeout into a normal `{success: false, message: '...aborted due to
// timeout'}` return — query functions then throw on `!success`, which is what
// actually triggers React Query's retry. Retrying a request that already
// burned 30s almost never helps (the endpoint is slow, not flaky) and
// previously stacked into 60-90s of total wait on a single slow navigation.
// Skip retries specifically for that case; keep normal retry behavior for
// everything else (transient network errors, 5xxs).
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  if (/timed? ?out|aborted/i.test(message)) return false
  return failureCount < 2
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        // A server prefetch that fails should fall straight through to the
        // client (which refetches on mount) instead of holding the page back
        // behind retry back-off.
        retry: isServer ? false : shouldRetry,
      },
      mutations: {
        retry: shouldRetry,
      },
      dehydrate: {
        // Also ship queries still in flight, so a prefetch that was started
        // but not awaited streams to the client instead of being dropped.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * The server gets a fresh client for every request (never share one between
 * users); the browser reuses a single client so React cannot throw it away if
 * it suspends during the initial render.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}
