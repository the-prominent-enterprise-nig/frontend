import { FileText } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const MEMOS = [
  {
    title: 'Revised Work-from-Home Policy',
    date: 'May 12',
    author: 'HR Department',
    tag: 'Policy',
  },
  { title: 'Q2 Budget Allocation Update', date: 'May 10', author: 'Finance', tag: 'Finance' },
  { title: 'Safety Protocol Reminder', date: 'May 8', author: 'Admin', tag: 'Safety' },
  {
    title: 'New Employee Onboarding Guide',
    date: 'May 5',
    author: 'HR Department',
    tag: 'General',
  },
]

const TAG_COLORS: Record<string, string> = {
  Policy: 'bg-purple-100 text-purple-700',
  Finance: 'bg-emerald-100 text-emerald-700',
  Safety: 'bg-red-100 text-red-700',
  General: 'bg-zinc-100 text-zinc-600',
}

export default function MemoAdvisoryWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 4

  return (
    <div className="flex flex-col gap-1">
      {MEMOS.slice(0, limit).map((memo, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg p-2 hover:bg-zinc-50 transition">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-900">{memo.title}</p>
            {!isCompact && (
              <p className="text-[10px] text-zinc-500 truncate">
                {memo.author} · {memo.date}
              </p>
            )}
          </div>
          {variant === 'lg' && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_COLORS[memo.tag] ?? 'bg-zinc-100 text-zinc-600'}`}
            >
              {memo.tag}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
