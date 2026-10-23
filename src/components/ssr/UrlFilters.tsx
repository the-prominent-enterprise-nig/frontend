'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type ParamValue = string | number | null | undefined

interface UrlFilters {
  /** Current search params (read-only). */
  params: URLSearchParams
  /**
   * Merge `patch` into the URL; an empty / null / undefined value removes the
   * key. `page` is reset unless the patch sets it, since a new filter
   * invalidates the current page.
   */
  setParams: (patch: Record<string, ParamValue>) => void
  /** True while the server is rendering the new result. */
  isPending: boolean
}

const UrlFiltersContext = createContext<UrlFilters | null>(null)

/**
 * Filters and paging live in the URL so a Server Component can read them from
 * `searchParams`: the page is shareable, survives refresh, and the result is
 * rendered (and streamed) on the server instead of being fetched in the
 * browser after hydration. Wrap the filter controls and the server-rendered
 * result in one provider; the result goes inside `<PendingDim>`.
 */
export function UrlFiltersProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const setParams = useCallback(
    (patch: Record<string, ParamValue>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      if (!('page' in patch)) next.delete('page')
      const query = next.toString()
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  const value = useMemo(
    () => ({ params: searchParams, setParams, isPending }),
    [searchParams, setParams, isPending]
  )

  return <UrlFiltersContext.Provider value={value}>{children}</UrlFiltersContext.Provider>
}

export function useUrlFilters(): UrlFilters {
  const value = useContext(UrlFiltersContext)
  if (!value) throw new Error('useUrlFilters must be used inside <UrlFiltersProvider>')
  return value
}

/** Fades the (server-rendered) result while a new one is being fetched. */
export function PendingDim({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  const { isPending } = useUrlFilters()
  return (
    <div
      aria-busy={isPending}
      className={`transition-opacity ${isPending ? 'opacity-60' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
