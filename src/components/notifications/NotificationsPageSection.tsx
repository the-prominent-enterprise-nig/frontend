'use client'

import { useMemo, useState } from 'react'
import { Archive, Bell, CheckCheck, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { showToast } from '@/src/components/ui/toast'
import {
  useNotificationsList,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/src/libs/query/notifications/useNotifications'
import { groupByDateBucket } from './notification-types'
import NotificationListItem from './NotificationListItem'
import type {
  NotificationItem,
  NotificationListResponse,
} from '@/src/schema/notifications/notification'
import type { ApiResponse } from '@/src/libs/api/client'

const LIMIT = 20

type FilterTab = 'all' | 'unread' | 'archived'

function Pagination({
  page,
  lastPage,
  onPage,
}: {
  page: number
  lastPage: number
  onPage: (p: number) => void
}) {
  if (lastPage <= 1) return null

  const pages = Array.from({ length: Math.min(lastPage, 5) }, (_, i) => {
    if (lastPage <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= lastPage - 2) return lastPage - 4 + i
    return page - 2 + i
  })

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
          className={`min-w-[2rem] rounded-lg px-2 py-1 text-sm transition ${
            p === page
              ? 'bg-prominent-purple-700 font-medium text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= lastPage}
        onClick={() => onPage(page + 1)}
        className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-zinc-100">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3.5 px-4 py-3.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NotificationsPageSection({
  initialData,
}: {
  initialData: ApiResponse<NotificationListResponse>
}) {
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<FilterTab>('all')

  const { data: unreadData } = useUnreadNotificationCount()
  const { data, isLoading, isPlaceholderData } = useNotificationsList(
    { page, limit: LIMIT, unreadOnly: tab === 'unread', archived: tab === 'archived' },
    true
  )
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const list = data ?? (page === 1 && tab === 'all' ? initialData : undefined)
  const total = list?.data?.total ?? 0
  const limit = list?.data?.limit ?? LIMIT
  const lastPage = Math.max(1, Math.ceil(total / limit))
  const unreadCount = unreadData?.data?.count ?? 0
  const notifications = useMemo(() => list?.data?.data ?? [], [list])
  const grouped = useMemo(() => groupByDateBucket(notifications), [notifications])

  function handleItemClick(notification: NotificationItem): void {
    if (!notification.isRead) {
      markRead.mutate(notification.id, {
        onError: () =>
          showToast({
            title: "Couldn't mark notification as read",
            status: 'error',
          }),
      })
    }
  }

  function handleMarkAllRead(): void {
    markAllRead.mutate(undefined, {
      onError: () =>
        showToast({ title: "Couldn't mark all notifications as read", status: 'error' }),
    })
  }

  function handleTab(next: FilterTab): void {
    setTab(next)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => handleTab('all')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              tab === 'all'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleTab('unread')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              tab === 'unread'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="rounded-full bg-prominent-orange-100 px-1.5 py-px text-[11px] font-semibold text-prominent-orange-700">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTab('archived')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              tab === 'archived'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            Archived
          </button>
        </div>

        {tab !== 'archived' && unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-prominent-orange-700 transition-colors hover:text-prominent-orange-800"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div
        className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
      >
        {isLoading && !list && <ListSkeleton />}

        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-3 py-16 text-center">
            {tab === 'unread' ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-300" strokeWidth={1.5} />
            ) : tab === 'archived' ? (
              <Archive className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />
            ) : (
              <Bell className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />
            )}
            <p className="text-sm font-medium text-zinc-600">
              {tab === 'unread'
                ? "You're all caught up"
                : tab === 'archived'
                  ? 'No archived notifications'
                  : 'No notifications yet'}
            </p>
            <p className="text-xs text-zinc-400">
              {tab === 'unread'
                ? 'Nothing new needs your attention right now.'
                : tab === 'archived'
                  ? 'Notifications move here automatically after 30 days.'
                  : "We'll let you know when something comes up."}
            </p>
          </div>
        )}

        {grouped.map(([bucket, items]) => (
          <div key={bucket}>
            <p className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {bucket}
            </p>
            <div className="divide-y divide-zinc-100">
              {items.map((notification, i) => (
                <div
                  key={notification.id}
                  className="animate-notif-item"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <NotificationListItem
                    notification={notification}
                    onClick={handleItemClick}
                    variant="comfortable"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-zinc-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}{' '}
            notifications
          </p>
          <Pagination page={page} lastPage={lastPage} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
