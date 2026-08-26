import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { getNotifications } from '@/src/libs/actions/notifications.actions'
import NotificationsPageSection from '@/src/components/notifications/NotificationsPageSection'

export const metadata = {
  title: 'Notifications | Prominent Enterprise',
}

export default async function NotificationsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const initialData = await getNotifications({ page: 1, limit: 20 })

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-prominent-purple-50 text-prominent-purple-700">
            <Bell className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Notifications</h1>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Everything that&apos;s needed your attention, browsable in full.
            </p>
          </div>
        </div>
        <NotificationsPageSection initialData={initialData} />
      </div>
    </div>
  )
}
