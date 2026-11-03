import { RefreshButton } from '@/src/components/ssr/RefreshButton'

/**
 * Inline error for one streamed section. A Server Component that fails inside
 * a `<Suspense>` would otherwise take the whole route to the error boundary;
 * fetching with `settle()` and rendering this keeps the rest of the page.
 */
export function SectionError({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <span>{message}</span>
      <RefreshButton />
    </div>
  )
}
