'use client'

import TablePagination from '@/src/components/common/TablePagination'
import { useUrlFilters } from '@/src/components/ssr/UrlFilters'
import type { PageInfo } from '@/src/components/ssr/paginate'

/**
 * The shared pager, driven by the URL instead of component state. The server
 * works out the page (see paginate.ts) and passes it in, so it can use fixed
 * pages or weight-bounded ones.
 */
export function UrlPagination({
  info,
  noun,
}: {
  info: PageInfo
  /** What is being counted, e.g. "item" / "branch". */
  noun: string
}): React.JSX.Element {
  const { setParams } = useUrlFilters()

  return (
    <TablePagination
      page={info.page}
      pageCount={info.pageCount}
      onPageChange={(next) => setParams({ page: next })}
      pageStart={info.pageStart}
      pageSize={info.pageSize}
      totalItems={info.totalItems}
      noun={noun}
    />
  )
}
