import { Activity } from 'lucide-react'

export default function SystemHealthPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-32 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
        <Activity className="h-8 w-8 text-indigo-400" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-zinc-900">System Health</h2>
      <p className="mt-2 text-sm text-zinc-500">Platform diagnostics and monitoring coming soon.</p>
      <span className="mt-4 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
        Coming Soon
      </span>
    </div>
  )
}
