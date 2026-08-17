'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
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
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative cursor-pointer rounded-full p-2 transition-colors hover:bg-gray-50"
      >
        <Bell className="h-5 w-5 text-gray-500" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.25 min-w-4.25 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5">
              <p className="text-sm font-semibold text-zinc-900">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="cursor-pointer text-xs font-medium text-prominent-orange-700 hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading && (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}

              {!isLoading && notifications.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-zinc-400">No notifications yet</p>
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
          </div>
        </>
      )}
    </div>
  )
}
