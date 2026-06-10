type ComingSoonProps = {
  title: string
  description?: string
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto flex min-h-90 max-w-3xl items-center justify-center">
        <div className="w-full rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-prominent-orange-600">
            Coming Soon
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900">{title}</h1>
          {description && <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>}
        </div>
      </div>
    </div>
  )
}
