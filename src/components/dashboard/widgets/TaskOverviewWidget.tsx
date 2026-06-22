import { useWidgetSize } from '../WidgetSizeContext'

const TASKS = [
  { label: 'CRM Follow-ups', completed: 6, total: 10, color: 'bg-purple-500' },
  { label: 'Lead Qualification', completed: 3, total: 5, color: 'bg-emerald-500' },
  { label: 'Stock Replenishment', completed: 2, total: 8, color: 'bg-amber-500' },
  { label: 'Invoice Collections', completed: 4, total: 6, color: 'bg-blue-500' },
  { label: 'Pending Deliveries', completed: 3, total: 4, color: 'bg-pink-500' },
]

export default function TaskOverviewWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const showSummary = !isCompact
  const taskLimit = isCompact ? 3 : 5

  return (
    <div className="flex flex-col gap-3">
      {showSummary && (
        <div className="flex gap-2">
          {[
            { label: 'Total', value: 33, color: 'text-zinc-900' },
            { label: 'Done', value: 18, color: 'text-emerald-600' },
            { label: 'Left', value: 15, color: 'text-amber-600' },
          ].map((s) => (
            <div
              key={s.label}
              className="min-w-0 flex-1 rounded-xl bg-zinc-50 p-2 text-center overflow-hidden"
            >
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        {TASKS.slice(0, taskLimit).map((task) => {
          const pct = Math.round((task.completed / task.total) * 100)
          return (
            <div key={task.label}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-zinc-700 truncate">{task.label}</p>
                <p className="text-[10px] text-zinc-500 shrink-0 ml-1">
                  {task.completed}/{task.total}
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-100">
                <div
                  className={`h-1.5 rounded-full transition-all ${task.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
