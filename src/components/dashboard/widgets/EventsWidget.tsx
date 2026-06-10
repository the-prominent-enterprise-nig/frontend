import { Calendar } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const EVENTS = [
  {
    title: 'Q2 Performance Review',
    date: 'May 15',
    type: 'Meeting',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    title: 'Team Building Activity',
    date: 'May 18',
    type: 'Event',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Payroll Cutoff Deadline',
    date: 'May 20',
    type: 'Deadline',
    color: 'bg-red-100 text-red-700',
  },
  {
    title: 'New Product Launch',
    date: 'May 22',
    type: 'Project',
    color: 'bg-emerald-100 text-emerald-700',
  },
  { title: 'Board Meeting', date: 'May 28', type: 'Meeting', color: 'bg-blue-100 text-blue-700' },
]

export default function EventsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 5

  return (
    <div className="flex flex-col gap-1">
      {EVENTS.slice(0, limit).map((event, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-50 transition">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50">
            <Calendar className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-900">{event.title}</p>
            {!isCompact && <p className="text-[10px] text-zinc-500">{event.date}</p>}
          </div>
          {variant !== 'xs' && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${event.color}`}
            >
              {event.type}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
