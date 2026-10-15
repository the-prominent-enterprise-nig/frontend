import { Skeleton } from '@/src/components/ui/Skeleton'

/** Page title + subtitle placeholder, sized like the real header. */
export function HeaderSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  )
}

/**
 * Rows of a table card. Keep `rows` close to the real first page so the page
 * does not jump when the data arrives (CLS).
 */
export function TableSkeleton({ rows = 8 }: { rows?: number }): React.JSX.Element {
  return (
    <div
      aria-busy
      aria-label="Loading"
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <Skeleton className="h-3 w-1/3" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-zinc-100 px-4 py-3.5 last:border-0"
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-48 max-w-[40%]" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </div>
  )
}
