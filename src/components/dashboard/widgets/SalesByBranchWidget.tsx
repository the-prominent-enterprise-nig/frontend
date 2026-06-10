import { useWidgetSize } from '../WidgetSizeContext'

export default function SalesByBranchWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'

  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-center">
      <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-medium text-zinc-500`}>
        Branch sales breakdown coming soon
      </p>
      {!isCompact && (
        <p className="mt-1 max-w-56 text-[11px] text-zinc-400">
          Sales orders do not store branch revenue data yet.
        </p>
      )}
    </div>
  )
}
