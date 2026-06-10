import { ArrowUpRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type StatCardProps = {
  label: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: LucideIcon
  iconColor: string
  iconBg: string
  href?: string
}

const changeColors: Record<NonNullable<StatCardProps['changeType']>, string> = {
  positive: 'text-green-600',
  negative: 'text-red-500',
  neutral: 'text-zinc-400',
}

export default function DashboardStatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor,
  iconBg,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <ArrowUpRight className="h-4 w-4 text-zinc-300" />
      </div>
      <div className="mt-4">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
        {change && (
          <p className={`mt-1 text-xs font-medium ${changeColors[changeType]}`}>{change}</p>
        )}
      </div>
    </div>
  )
}
