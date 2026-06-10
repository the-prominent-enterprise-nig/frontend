import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type ActionCardProps = {
  label: string
  href: string
  icon: LucideIcon
  description?: string
}

export default function DashboardActionCard({
  label,
  href,
  icon: Icon,
  description,
}: ActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-prominent-purple-100">
        <Icon className="h-5 w-5 text-prominent-purple-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900 group-hover:text-prominent-purple-700">
          {label}
        </p>
        {description && <p className="mt-0.5 truncate text-xs text-zinc-500">{description}</p>}
      </div>
    </Link>
  )
}
