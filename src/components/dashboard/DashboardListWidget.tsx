type ActivityItem = {
  id: string
  title: string
  subtitle: string
  timestamp: string
  status?: 'pending' | 'approved' | 'rejected' | 'info'
}

const statusStyles: Record<NonNullable<ActivityItem['status']>, string> = {
  pending: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  info: 'bg-zinc-100 text-zinc-600',
}

const statusLabels: Record<NonNullable<ActivityItem['status']>, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  info: 'Info',
}

type DashboardListWidgetProps = {
  items: ActivityItem[]
  emptyMessage?: string
}

export default function DashboardListWidget({
  items,
  emptyMessage = 'No recent activity.',
}: DashboardListWidgetProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <ul className="divide-y divide-zinc-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{item.subtitle}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {item.status && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[item.status]}`}
                >
                  {statusLabels[item.status]}
                </span>
              )}
              <span className="text-xs text-zinc-400">{item.timestamp}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
