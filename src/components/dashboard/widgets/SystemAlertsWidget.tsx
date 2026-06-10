import { AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const ALERTS = [
  {
    type: 'warning',
    icon: AlertTriangle,
    title: 'Low inventory stock',
    body: 'Some products may be below minimum threshold',
    time: '',
  },
  {
    type: 'info',
    icon: Info,
    title: 'Scheduled maintenance',
    body: 'System backup running tonight at 11 PM',
    time: '',
  },
  {
    type: 'success',
    icon: CheckCircle,
    title: 'System operational',
    body: 'All services are running normally',
    time: '',
  },
]

const STYLE: Record<string, string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

export default function SystemAlertsWidget() {
  const { variant } = useWidgetSize()
  const showBody = variant === 'lg' || variant === 'md'
  const limit = variant === 'xs' ? 2 : 3

  return (
    <div className="flex flex-col gap-1.5">
      {ALERTS.slice(0, limit).map((alert, i) => {
        const Icon = alert.icon
        const style = STYLE[alert.type] ?? STYLE.info
        return (
          <div key={i} className={`flex items-start gap-2 rounded-lg border p-2 ${style}`}>
            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{alert.title}</p>
              {showBody && (
                <p className="text-[10px] opacity-80 mt-0.5 line-clamp-1">{alert.body}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
