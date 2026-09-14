type StatusBadgeSize = 'xs' | 'sm'

const SIZE_CLASSES: Record<StatusBadgeSize, string> = {
  xs: 'px-2 py-0.5 text-[11px]',
  sm: 'px-2.5 py-0.5 text-xs',
}

/**
 * Generic colored status pill. Several screens (serial numbers, batches,
 * adjustments, transfers, ...) each hand-rolled their own
 * `Record<Status, string>` Tailwind color map plus an inline `<span>` for
 * this exact pattern — this is the shared primitive new/touched screens
 * should build on instead of adding another copy.
 */
export function StatusBadge({
  label,
  colorClassName,
  dotClassName,
  icon,
  size = 'sm',
  className = '',
}: {
  label: string
  /** Tailwind bg/text classes for this status, e.g. "bg-green-100 text-green-700". */
  colorClassName: string
  /** Optional solid `bg-*` class for a small leading dot, e.g. "bg-green-500". */
  dotClassName?: string
  /** Optional leading icon (e.g. a lucide-react icon), shown instead of the dot. */
  icon?: React.ReactNode
  size?: StatusBadgeSize
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${SIZE_CLASSES[size]} ${colorClassName} ${className}`}
    >
      {icon}
      {!icon && dotClassName && (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`} />
      )}
      {label}
    </span>
  )
}
