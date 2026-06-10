import { UserPlus, FileEdit, CheckCircle, AlertTriangle, Settings } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const ACTIVITIES = [
  {
    icon: UserPlus,
    color: 'text-purple-500 bg-purple-50',
    label: 'New employee added',
    sub: 'Miguel Rivera — Operations',
    time: '12m ago',
  },
  {
    icon: FileEdit,
    color: 'text-blue-500 bg-blue-50',
    label: 'Payroll period updated',
    sub: 'May 2026 1st Half',
    time: '1h ago',
  },
  {
    icon: CheckCircle,
    color: 'text-emerald-500 bg-emerald-50',
    label: 'Leave request approved',
    sub: 'Ana Reyes — 1 day',
    time: '2h ago',
  },
  {
    icon: AlertTriangle,
    color: 'text-amber-500 bg-amber-50',
    label: 'Low stock alert triggered',
    sub: 'Product SKU-0412',
    time: '3h ago',
  },
  {
    icon: Settings,
    color: 'text-zinc-400 bg-zinc-100',
    label: 'Role permissions updated',
    sub: 'HR Manager role',
    time: '5h ago',
  },
]

export default function RecentActivityWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 5

  return (
    <div className="flex flex-col gap-0.5">
      {ACTIVITIES.slice(0, limit).map((act, i) => {
        const Icon = act.icon
        return (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${act.color}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">{act.label}</p>
              {!isCompact && <p className="truncate text-[10px] text-zinc-500">{act.sub}</p>}
            </div>
            <p className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">{act.time}</p>
          </div>
        )
      })}
    </div>
  )
}
