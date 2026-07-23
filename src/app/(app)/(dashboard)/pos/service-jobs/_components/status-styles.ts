// Shared between ServiceJobsList's table badge and ServiceJobDetailModal's
// header badge so the two views never drift. Follows the bg-X-100/text-X-700
// badge convention used elsewhere in the app (e.g. ItemMasterTable's
// Bundle/Variants/Service tags).
export const SERVICE_DRAFT_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sourcing: 'bg-blue-100 text-blue-700',
  installing: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}
