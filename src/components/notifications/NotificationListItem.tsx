'use client'

import Link from 'next/link'
import { cn } from '@/src/libs/tailwind-merge/utils'
import { formatRelativeTime } from '@/src/libs/format/date'
import {
  NOTIFICATION_TYPE_META,
  STATUS_STYLE,
  getNotificationHref,
  resolveNotificationStatus,
} from './notification-types'
import type { NotificationItem } from '@/src/schema/notifications/notification'

interface NotificationListItemProps {
  notification: NotificationItem
  onClick: (notification: NotificationItem) => void
}

export default function NotificationListItem({ notification, onClick }: NotificationListItemProps) {
  const meta = NOTIFICATION_TYPE_META[notification.eventType]
  const style = STATUS_STYLE[resolveNotificationStatus(notification)]
  const Icon = meta.icon
  const BadgeIcon = style.badgeIcon
  const href = getNotificationHref(notification)

  return (
    <Link
      href={href}
      onClick={() => onClick(notification)}
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50',
        !notification.isRead && 'bg-prominent-orange-50/40'
      )}
    >
      <span className="relative flex h-8 w-8 shrink-0">
        <span
          className={cn('flex h-8 w-8 items-center justify-center rounded-full', style.accentClass)}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-white',
            style.badgeClass
          )}
        >
          <BadgeIcon className="h-2 w-2" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <span
            className={cn(
              'text-sm',
              notification.isRead ? 'font-medium text-zinc-700' : 'font-semibold text-zinc-900'
            )}
          >
            {notification.title}
          </span>
          {!notification.isRead && (
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-prominent-orange-500" />
          )}
        </span>
        <span className="line-clamp-2 block text-xs text-zinc-500">{notification.message}</span>
        <span className="mt-0.5 block text-[11px] text-zinc-400">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
    </Link>
  )
}
