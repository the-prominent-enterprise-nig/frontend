export default function PayslipsLoadingPage() {
  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="animate-pulse h-7 w-32 bg-gray-200 rounded" />
            <div className="animate-pulse h-4 w-56 bg-gray-100 rounded" />
          </div>
          <div className="animate-pulse h-9 w-32 bg-gray-200 rounded-lg" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-4">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-4 bg-gray-200 rounded w-1/5" />
              <div className="h-4 bg-gray-200 rounded w-1/5" />
              <div className="h-4 bg-gray-200 rounded w-1/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
