'use client'

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { STALE } from '@/src/libs/query/stale-times'
import type { ApiResponse } from '@/src/libs/api/client'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/src/libs/actions/notifications.actions'
import type {
  NotificationListResponse,
  UnreadCountResponse,
} from '@/src/schema/notifications/notification'

const UNREAD_COUNT_KEY = ['notifications-unread-count'] as const
const LIST_KEY_PREFIX = 'notifications' as const

/** Always enabled while the bell is rendered — the badge must be correct
 * even with the panel closed. Polls as a safety net independent of the
 * socket push, and refetches on window focus (a per-query override — the
 * app-wide QueryProvider default is false). */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadNotificationCount,
    staleTime: STALE.REALTIME,
    refetchInterval: STALE.REALTIME,
    refetchOnWindowFocus: true,
  })
}

/** Lazy — only fetches once the panel has been opened at least once. */
export function useNotificationsList(params: { unreadOnly?: boolean } = {}, enabled: boolean) {
  return useQuery({
    queryKey: [LIST_KEY_PREFIX, params],
    queryFn: () => getNotifications({ page: 1, limit: 20, ...params }),
    enabled,
    staleTime: STALE.REALTIME,
    placeholderData: keepPreviousData,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<ApiResponse<UnreadCountResponse>>(UNREAD_COUNT_KEY, (old) =>
        old?.data ? { ...old, data: { count: Math.max(0, old.data.count - 1) } } : old
      )
      queryClient.setQueriesData<ApiResponse<NotificationListResponse>>(
        { queryKey: [LIST_KEY_PREFIX], exact: false },
        (old) =>
          old?.data
            ? {
                ...old,
                data: {
                  ...old.data,
                  data: old.data.data.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
                },
              }
            : old
      )
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.setQueryData<ApiResponse<UnreadCountResponse>>(UNREAD_COUNT_KEY, (old) =>
        old ? { ...old, data: { count: 0 } } : old
      )
      queryClient.setQueriesData<ApiResponse<NotificationListResponse>>(
        { queryKey: [LIST_KEY_PREFIX], exact: false },
        (old) =>
          old?.data
            ? {
                ...old,
                data: { ...old.data, data: old.data.data.map((n) => ({ ...n, isRead: true })) },
              }
            : old
      )
    },
  })
}

export { UNREAD_COUNT_KEY, LIST_KEY_PREFIX }
