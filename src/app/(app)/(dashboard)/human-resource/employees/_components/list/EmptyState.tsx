// Reusable Empty State Component (Web + Mobile)
export function EmptyState({
  message = 'No data found',
  showHint = false,
}: {
  message?: string
  showHint?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center text-gray-500">
      <svg
        className="w-12 h-12 mb-3 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <p className="text-sm font-medium">{message}</p>
      {showHint && <p className="text-xs mt-1">Try adjusting your filters</p>}
    </div>
  )
}

// Table Empty Row (Desktop)
export function EmptyTableRow({
  colSpan = 6,
  hasActiveFilters,
}: {
  colSpan?: number
  hasActiveFilters: boolean
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center">
        <EmptyState message="No employees found" showHint={hasActiveFilters} />
      </td>
    </tr>
  )
}

// Mobile Empty State Wrapper
export function EmptyMobileState({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  return (
    <div className="px-4 py-12 text-center">
      <EmptyState message="No employees found" showHint={hasActiveFilters} />
    </div>
  )
}
