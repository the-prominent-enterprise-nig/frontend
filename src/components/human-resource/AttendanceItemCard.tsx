import Link from 'next/link'

type AttendanceItemCardProps = {
  title: string
  description: string
  usedBy: string[]
  href?: string
}

export default function AttendanceItemCard({
  title,
  description,
  usedBy,
  href,
}: AttendanceItemCardProps) {
  const content = (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        {href ? <span className="text-xs text-zinc-400">View</span> : null}
      </div>

      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Used by</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {usedBy.map((role) => (
            <span key={role} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
              {role}
            </span>
          ))}
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
