'use client'

import Link from 'next/link'
import { cn } from '@/src/libs/tailwind-merge/utils'
import { formatCompactRelativeTime } from '@/src/libs/format/date'
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
  /** 'compact' is the bell dropdown; 'comfortable' is the full /notifications page. */
  variant?: 'compact' | 'comfortable'
}

export default function NotificationListItem({
  notification,
  onClick,
  variant = 'compact',
}: NotificationListItemProps) {
  const meta = NOTIFICATION_TYPE_META[notification.eventType]
  const style = STATUS_STYLE[resolveNotificationStatus(notification)]
  const Icon = meta.icon
  const BadgeIcon = style.badgeIcon
  const href = getNotificationHref(notification)
  const isComfortable = variant === 'comfortable'
  const avatarSize = isComfortable ? 'h-10 w-10' : 'h-8 w-8'
  const badgeSize = isComfortable ? 'h-4 w-4' : 'h-3.5 w-3.5'

  return (
    <Link
      href={href}
      onClick={() => onClick(notification)}
      className={cn(
        'group flex items-start gap-3 text-left transition-colors hover:bg-zinc-50',
        isComfortable ? 'gap-3.5 border-l-2 px-4 py-3.5' : 'px-3 py-2.5',
        !notification.isRead
          ? isComfortable
            ? 'border-prominent-orange-500 bg-prominent-orange-50/30'
            : 'border-transparent bg-prominent-orange-50/40'
          : 'border-transparent'
      )}
    >
      <span className={cn('relative flex shrink-0', avatarSize)}>
        <span
          className={cn(
            'flex items-center justify-center rounded-full transition-transform group-hover:scale-105',
            avatarSize,
            style.accentClass
          )}
        >
          <Icon className={isComfortable ? 'h-4.5 w-4.5' : 'h-4 w-4'} />
        </span>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ring-2 ring-white',
            badgeSize,
            style.badgeClass
          )}
        >
          <BadgeIcon className={isComfortable ? 'h-2.5 w-2.5' : 'h-2 w-2'} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <span
            className={cn(
              isComfortable ? 'text-[13.5px]' : 'text-sm',
              notification.isRead ? 'font-medium text-zinc-700' : 'font-semibold text-zinc-900'
            )}
          >
            {notification.title}
          </span>
          {!notification.isRead && (
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-prominent-orange-500" />
          )}
        </span>
        <span
          className={cn(
            'block text-zinc-500',
            isComfortable ? 'mt-0.5 text-[13px]' : 'line-clamp-2 text-xs'
          )}
        >
          {notification.message}
        </span>
        <span className="mt-1 block text-[11px] text-zinc-400">
          {formatCompactRelativeTime(notification.createdAt)}
        </span>
      </span>
    </Link>
  )
}
