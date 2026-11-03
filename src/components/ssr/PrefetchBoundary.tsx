import type { ReactNode } from 'react'
import { dehydrate, HydrationBoundary, type QueryClient } from '@tanstack/react-query'
import { getQueryClient } from '@/src/libs/query/get-query-client'

interface Props {
  /**
   * Starts the page's queries on the server, e.g.
   * `(qc) => qc.prefetchQuery(employeeQueries.list({}))`. Await everything the
   * first paint needs; `prefetchQuery` never throws, so a failed call simply
   * leaves the query for the client to fetch on mount.
   */
  prefetch: (queryClient: QueryClient) => Promise<unknown>
  children: ReactNode
}

/**
 * Server Component. Runs the prefetch, then hands the result to the client
 * tree inside it so its `useQuery(...)` calls render real rows in the server
 * HTML and do not refetch on mount. Place it inside a `<Suspense>` so the page
 * shell and skeleton stream first and the data follows.
 */
export async function PrefetchBoundary({ prefetch, children }: Props): Promise<React.JSX.Element> {
  const queryClient = getQueryClient()
  await prefetch(queryClient)
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>
}
