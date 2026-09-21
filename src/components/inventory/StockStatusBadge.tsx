import { AlertTriangle, Truck } from 'lucide-react'
import {
  IN_TRANSIT_META,
  STOCK_STATUS_META,
  type StockStatus,
} from '@/src/libs/inventory/stock-status'

type Props = {
  status: StockStatus
  /** Units on the road toward this item/location; a second badge when > 0. */
  inTransitQty?: number
  size?: 'md' | 'sm'
  /** Stack the two badges instead of placing them side by side. */
  stacked?: boolean
}

const SIZE = {
  md: 'px-[9px] py-[3px] text-[13.5px]',
  sm: 'px-2 py-0.5 text-[11px]',
}

/** Stock state plus, when anything is on its way, an "In Transit · N" badge. */
export function StockStatusBadge({
  status,
  inTransitQty = 0,
  size = 'md',
  stacked = false,
}: Props): React.ReactElement {
  const meta = STOCK_STATUS_META[status]
  const pill = `inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium ${SIZE[size]}`
  return (
    <span
      className={`inline-flex gap-1 ${stacked ? 'flex-col items-center' : 'flex-wrap items-center'}`}
    >
      <span className={`${pill} ${meta.badge}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
        {status === 'low' && <AlertTriangle className="h-3 w-3" />}
        {meta.label}
      </span>
      {inTransitQty > 0 && (
        <span className={`${pill} ${IN_TRANSIT_META.badge}`}>
          <Truck className="h-3 w-3" />
          {IN_TRANSIT_META.label} · {inTransitQty.toLocaleString()}
        </span>
      )}
    </span>
  )
}
