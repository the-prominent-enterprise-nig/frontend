import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export type ModuleCardStat = {
  label: string
  value: string
}

export type DashboardModuleCardProps = {
  label: string
  description: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  href: string
  stats: ModuleCardStat[]
}

export default function DashboardModuleCard({
  label,
  description,
  icon: Icon,
  iconColor,
  iconBg,
  href,
  stats,
}: DashboardModuleCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div>
        <div className="flex items-start justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <ArrowUpRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-500" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-zinc-900">{label}</h3>
        <p className="mt-1 text-sm text-zinc-500 leading-snug">{description}</p>
      </div>

      {stats.length > 0 && (
        <div className="mt-6 flex gap-6 border-t border-zinc-100 pt-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-zinc-400">{stat.label}</p>
              <p className="mt-0.5 text-sm font-bold text-zinc-900">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}
