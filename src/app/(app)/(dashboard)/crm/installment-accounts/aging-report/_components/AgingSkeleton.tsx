import { Skeleton } from '@/src/components/ui/Skeleton'
import { TableSkeleton } from '@/src/components/ssr/skeletons'

export function AgingHeading(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-prominent-purple-900">AR Aging Report</h1>
      <p className="mt-1 text-sm text-gray-500">
        Outstanding receivables — active installment accounts and standalone AR invoices — grouped
        by branch and collector.
      </p>
    </div>
  )
}

export function FilterBarSkeleton(): React.JSX.Element {
  return <Skeleton className="mb-4 h-[58px] w-full rounded-xl" />
}

export function ActionsSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <Skeleton className="h-10 w-28 rounded-xl" />
      <Skeleton className="h-10 w-24 rounded-xl" />
    </div>
  )
}

/** The matrix and branch cards before the summary arrives. */
export function ReportSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <TableSkeleton rows={6} />
      <TableSkeleton rows={4} />
    </div>
  )
}

/** Whole-page placeholder for loading.tsx; the title is real text. */
export function AgingPageSkeleton(): React.JSX.Element {
  return (
    <div className="px-3 py-5 sm:px-4 lg:px-6 lg:py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <AgingHeading />
        <ActionsSkeleton />
      </header>
      <FilterBarSkeleton />
      <ReportSkeleton />
    </div>
  )
}
