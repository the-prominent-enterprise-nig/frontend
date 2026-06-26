import { ShoppingBag, RotateCcw, XCircle, ArrowLeftRight } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const APPROVALS = [
  {
    icon: ShoppingBag,
    iconStyle: 'text-blue-500 bg-blue-50',
    label: 'Purchase Order #PO-0012',
    sub: 'Submitted by Juan dela Cruz',
    time: '10m ago',
    badge: 'PO',
    badgeStyle: 'bg-blue-100 text-blue-700',
  },
  {
    icon: XCircle,
    iconStyle: 'text-red-500 bg-red-50',
    label: 'Void Request — Invoice #1043',
    sub: 'Cebu Branch · ₱12,500',
    time: '1h ago',
    badge: 'Void',
    badgeStyle: 'bg-red-100 text-red-700',
  },
  {
    icon: RotateCcw,
    iconStyle: 'text-amber-500 bg-amber-50',
    label: 'Refund — Invoice #0998',
    sub: 'Manila Branch · ₱3,200',
    time: '2h ago',
    badge: 'Refund',
    badgeStyle: 'bg-amber-100 text-amber-700',
  },
  {
    icon: ArrowLeftRight,
    iconStyle: 'text-purple-500 bg-purple-50',
    label: 'Stock Transfer #ST-0034',
    sub: 'Main WH → Davao Branch',
    time: '3h ago',
    badge: 'Transfer',
    badgeStyle: 'bg-purple-100 text-purple-700',
  },
]

export default function PendingApprovalsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 4

  if (APPROVALS.length === 0) {
    return (
      <div className="flex h-full min-h-16 items-center justify-center">
        <p className="text-xs text-zinc-400">No pending approvals</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {APPROVALS.slice(0, limit).map((item, i) => {
        const Icon = item.icon
        return (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-zinc-50"
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.iconStyle}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">{item.label}</p>
              {!isCompact && <p className="truncate text-[10px] text-zinc-500">{item.sub}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${item.badgeStyle}`}>
                {item.badge}
              </span>
              <p className="text-[10px] text-zinc-400">{item.time}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
