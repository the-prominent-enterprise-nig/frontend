type DashboardSectionProps = {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}

export default function DashboardSection({
  title,
  description,
  action,
  children,
}: DashboardSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}
