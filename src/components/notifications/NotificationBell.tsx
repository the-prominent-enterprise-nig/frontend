'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Bell, BellOff, CheckCheck } from 'lucide-react'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { showToast } from '@/src/components/ui/toast'
import {
  useUnreadNotificationCount,
  useNotificationsList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  UNREAD_COUNT_KEY,
  LIST_KEY_PREFIX,
} from '@/src/libs/query/notifications/useNotifications'
import {
  useNotificationsSocket,
  type NotificationPushPayload,
} from '@/src/libs/hooks/useNotificationsSocket'
import NotificationListItem from './NotificationListItem'
import type { ApiResponse } from '@/src/libs/api/client'
import type {
  NotificationItem,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/src/schema/notifications/notification'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: unreadData } = useUnreadNotificationCount()
  const { data: listData, isLoading } = useNotificationsList({}, open)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  useNotificationsSocket(true, {
    onNotificationCreated: (payload: NotificationPushPayload) => {
      queryClient.setQueryData<ApiResponse<UnreadCountResponse>>(UNREAD_COUNT_KEY, (old) => ({
        success: true,
        data: { count: (old?.data?.count ?? 0) + 1 },
      }))
      const asItem: NotificationItem = { ...payload, isRead: false, readAt: null }
      queryClient.setQueriesData<ApiResponse<NotificationListResponse>>(
        { queryKey: [LIST_KEY_PREFIX], exact: false },
        (old) =>
          old?.data
            ? {
                ...old,
                data: { ...old.data, data: [asItem, ...old.data.data], total: old.data.total + 1 },
              }
            : old
      )
    },
  })

  const unreadCount = unreadData?.data?.count ?? 0
  const notifications = listData?.data?.data ?? []

  function handleItemClick(notification: NotificationItem) {
    setOpen(false)
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

  function handleMarkAllRead() {
    markAllRead.mutate(undefined, {
      onError: () =>
        showToast({ title: "Couldn't mark all notifications as read", status: 'error' }),
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        onClick={() => setOpen((v) => !v)}
        className="relative cursor-pointer rounded-full p-2 text-gray-500 transition-colors hover:bg-prominent-purple-50 hover:text-prominent-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-prominent-purple-300"
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.25 min-w-4.25 items-center justify-center rounded-full bg-prominent-orange-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="animate-notif-dropdown absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/10">
            <div className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-900">Notifications</p>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-prominent-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-prominent-orange-700">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex cursor-pointer items-center gap-1 text-xs font-medium text-prominent-orange-700 transition-colors hover:text-prominent-orange-800"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 divide-y divide-zinc-50 overflow-y-auto">
              {isLoading && (
                <div className="space-y-3 p-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-1.5 pt-0.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && notifications.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                  <BellOff className="h-6 w-6 text-zinc-300" strokeWidth={1.5} />
                  <p className="text-sm text-zinc-400">No notifications yet</p>
                </div>
              )}

              {!isLoading &&
                notifications.map((notification) => (
                  <NotificationListItem
                    key={notification.id}
                    notification={notification}
                    onClick={handleItemClick}
                  />
                ))}
            </div>

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="group flex items-center justify-center gap-1.5 border-t border-zinc-100 px-3 py-2.5 text-center text-xs font-semibold text-prominent-purple-700 transition-colors hover:bg-prominent-purple-50"
            >
              View all notifications
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
