import Link from 'next/link'
import type { ComponentType } from 'react'

type HrModuleCardProps = {
  title: string
  description: string
  href: string
  icon: ComponentType<{ className?: string }>
}

export default function HrModuleCard({ title, description, href, icon: Icon }: HrModuleCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-xl bg-zinc-100 p-3">
          <Icon className="h-5 w-5 text-zinc-700" />
        </div>
        <span className="text-xs font-medium text-zinc-400 transition group-hover:text-zinc-600">
          Open
        </span>
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
      </div>
    </Link>
  )
}
