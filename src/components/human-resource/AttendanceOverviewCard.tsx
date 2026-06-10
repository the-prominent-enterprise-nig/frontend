type AttendanceOverviewCardProps = {
  title: string
  value: string
  subtitle: string
  onClick?: () => void
}

export default function AttendanceOverviewCard({
  title,
  value,
  subtitle,
  onClick,
}: AttendanceOverviewCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <p className="text-sm text-zinc-500">{title}</p>
      <h3 className="mt-2 text-2xl font-semibold text-zinc-900">{value}</h3>
      <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>
    </button>
  )
}
