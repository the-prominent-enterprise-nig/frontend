import { Megaphone } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const ANNOUNCEMENTS = [
  {
    title: 'Company Outing — May 24',
    body: 'Join us for a company-wide outing at La Mesa Eco Park. Registration closes May 18.',
    date: '2 hours ago',
    urgent: false,
  },
  {
    title: '⚠️ System Maintenance Window',
    body: 'The ERP system will be unavailable on May 16 from 10 PM to 2 AM for upgrades.',
    date: '5 hours ago',
    urgent: true,
  },
  {
    title: 'Dress Code Reminder for Q2 Review',
    body: 'Business attire is required for all in-office employees during the Q2 review week.',
    date: '1 day ago',
    urgent: false,
  },
]

export default function AnnouncementsWidget() {
  const { variant } = useWidgetSize()
  const showBody = variant === 'lg' || variant === 'md'
  const limit = variant === 'xs' ? 2 : 3

  return (
    <div className="flex flex-col gap-2">
      {ANNOUNCEMENTS.slice(0, limit).map((item, i) => (
        <div
          key={i}
          className={`rounded-lg border p-2.5 ${item.urgent ? 'border-red-200 bg-red-50' : 'border-zinc-100 bg-white'}`}
        >
          <div className="flex min-w-0 items-start gap-2">
            <Megaphone
              className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${item.urgent ? 'text-red-500' : 'text-purple-500'}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-900">{item.title}</p>
              {showBody && (
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                  {item.body}
                </p>
              )}
              <p className="text-[10px] text-zinc-400 mt-1">{item.date}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
