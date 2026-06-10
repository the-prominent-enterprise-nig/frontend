import { Bell, Check } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const REMINDERS = [
  { text: 'Submit Q2 expense reports', due: 'Due today', urgent: true },
  { text: 'Review leave requests (7 pending)', due: 'Due tomorrow', urgent: false },
  { text: 'Approve payroll for May period', due: 'May 20', urgent: false },
  { text: 'Update employee records for new hires', due: 'May 22', urgent: false },
  { text: 'Conduct department performance review', due: 'May 28', urgent: false },
]

export default function RemindersWidget() {
  const { variant } = useWidgetSize()
  const limit = variant === 'xs' ? 3 : 5

  return (
    <div className="flex flex-col gap-1">
      {REMINDERS.slice(0, limit).map((r, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg p-2 hover:bg-zinc-50 transition">
          <div
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${r.urgent ? 'border-red-400 bg-red-50' : 'border-zinc-200'}`}
          >
            <Check className={`h-2.5 w-2.5 ${r.urgent ? 'text-red-400' : 'text-zinc-300'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-800 leading-snug truncate">{r.text}</p>
            {variant !== 'xs' && (
              <p
                className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${r.urgent ? 'font-medium text-red-500' : 'text-zinc-400'}`}
              >
                <Bell className="h-2.5 w-2.5" />
                {r.due}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
