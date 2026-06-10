import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'

type AlertItem = {
  id: string
  message: string
  severity: 'warning' | 'error' | 'info' | 'success'
  timestamp: string
}

const severityConfig = {
  warning: {
    container: 'border-orange-200 bg-orange-50',
    icon: AlertTriangle,
    iconColor: 'text-orange-500',
    text: 'text-orange-800',
    time: 'text-orange-500',
  },
  error: {
    container: 'border-red-200 bg-red-50',
    icon: XCircle,
    iconColor: 'text-red-500',
    text: 'text-red-800',
    time: 'text-red-400',
  },
  info: {
    container: 'border-blue-200 bg-blue-50',
    icon: Info,
    iconColor: 'text-blue-500',
    text: 'text-blue-800',
    time: 'text-blue-400',
  },
  success: {
    container: 'border-green-200 bg-green-50',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    text: 'text-green-800',
    time: 'text-green-500',
  },
}

type DashboardAlertCardProps = {
  alerts: AlertItem[]
  emptyMessage?: string
}

export default function DashboardAlertCard({
  alerts,
  emptyMessage = 'No alerts at this time.',
}: DashboardAlertCardProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const cfg = severityConfig[alert.severity]
        const Icon = cfg.icon
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-xl border p-4 ${cfg.container}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconColor}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${cfg.text}`}>{alert.message}</p>
            </div>
            <span className={`shrink-0 text-xs ${cfg.time}`}>{alert.timestamp}</span>
          </div>
        )
      })}
    </div>
  )
}
