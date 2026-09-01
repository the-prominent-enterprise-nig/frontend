'use server'

import { api } from '@/src/libs/api/client'
import type {
  NotificationListResponse,
  UnreadCountResponse,
} from '@/src/schema/notifications/notification'

type ListParams = {
  page?: number
  limit?: number
  unreadOnly?: boolean
  archived?: boolean
}

export async function getNotifications(params: ListParams = {}) {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page,
    limit: params.limit,
    unreadOnly: params.unreadOnly,
    archived: params.archived,
  }
  return api.get<NotificationListResponse>('/notifications', query)
}

export async function getUnreadNotificationCount() {
  return api.get<UnreadCountResponse>('/notifications/unread-count')
}

export async function markNotificationRead(id: string) {
  return api.patch<{ success: true }>(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead() {
  return api.patch<{ success: true }>('/notifications/read-all')
}
