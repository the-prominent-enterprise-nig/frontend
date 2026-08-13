import {
  FileCheck,
  RotateCcw,
  PackageX,
  Receipt,
  CreditCard,
  Package,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { NotificationItem, NotificationType } from '@/src/schema/notifications/notification'

type NotificationStatus = 'needs-action' | 'resolved' | 'rejected' | 'alert'

interface NotificationTypeMeta {
  icon: ComponentType<{ className?: string }>
  // The status a *_resolved eventType defaults to — 'resolved' reads as
  // "approved". resolveNotificationStatus() downgrades it to 'rejected' when
  // metadata says the actual outcome wasn't approval (see notify calls in
  // release-form-requests.service.ts / return-refund-requests.service.ts).
  status: NotificationStatus
  getHref: (entityId: string) => string
}

const posReleaseHref = (): string => '/pos/release-approvals'
const posReturnRefundHref = (): string => '/pos/return-refund-approvals'
const reorderHref = (): string => '/inventory/reorder'
const arInvoiceHref = (entityId: string): string => `/accounting/ar-invoices/${entityId}`
const creditApplicationHref = (entityId: string): string => `/pos/credit-applications/${entityId}`
const itemMasterHref = (): string => '/inventory/items'
// Found live manually testing Scenario 26 Part 9 — /inventory/adjustments
// has no page of its own (AdjustmentList only ever renders as a tab inside
// CountingHub); the old href 404'd on every click-through.
const stockAdjustmentHref = (): string => '/inventory/counting?tab=adjustments'

// Status drives both the avatar tint and a small corner badge icon (see
// STATUS_STYLE below / NotificationListItem.tsx) — the entity icon alone
// (e.g. FileCheck for a release form) doesn't change between "needs your
// action" and "your request was resolved", so without this the two looked
// almost identical at a glance beyond a subtle color tint. Title text stays
// plain black/zinc regardless of status — color lives on the icons only.
export const STATUS_STYLE: Record<
  NotificationStatus,
  { accentClass: string; badgeIcon: ComponentType<{ className?: string }>; badgeClass: string }
> = {
  'needs-action': {
    accentClass: 'text-prominent-orange-600 bg-prominent-orange-50',
    badgeIcon: Clock,
    badgeClass: 'bg-prominent-orange-500 text-white',
  },
  resolved: {
    accentClass: 'text-emerald-600 bg-emerald-50',
    badgeIcon: CheckCircle2,
    badgeClass: 'bg-emerald-500 text-white',
  },
  rejected: {
    accentClass: 'text-red-600 bg-red-50',
    badgeIcon: XCircle,
    badgeClass: 'bg-red-500 text-white',
  },
  alert: {
    accentClass: 'text-red-600 bg-red-50',
    badgeIcon: AlertTriangle,
    badgeClass: 'bg-red-500 text-white',
  },
}

export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  pos_release_form_created: {
    icon: FileCheck,
    status: 'needs-action',
    getHref: posReleaseHref,
  },
  pos_release_form_resolved: { icon: FileCheck, status: 'resolved', getHref: posReleaseHref },
  pos_return_refund_created: {
    icon: RotateCcw,
    status: 'needs-action',
    getHref: posReturnRefundHref,
  },
  pos_return_refund_resolved: {
    icon: RotateCcw,
    status: 'resolved',
    getHref: posReturnRefundHref,
  },
  inventory_low_stock: { icon: PackageX, status: 'alert', getHref: reorderHref },
  ar_invoice_overdue: { icon: Receipt, status: 'alert', getHref: arInvoiceHref },
  credit_application_investigation_needed: {
    icon: CreditCard,
    status: 'needs-action',
    getHref: creditApplicationHref,
  },
  credit_application_approval_needed: {
    icon: CreditCard,
    status: 'needs-action',
    getHref: creditApplicationHref,
  },
  credit_application_resolved: {
    icon: CreditCard,
    status: 'resolved',
    getHref: creditApplicationHref,
  },
  item_master_confirm_accounting_needed: {
    icon: Package,
    status: 'needs-action',
    getHref: itemMasterHref,
  },
  item_master_approval_needed: {
    icon: Package,
    status: 'needs-action',
    getHref: itemMasterHref,
  },
  item_master_resolved: { icon: Package, status: 'resolved', getHref: itemMasterHref },
  stock_adjustment_confirm_needed: {
    icon: ClipboardList,
    status: 'needs-action',
    getHref: stockAdjustmentHref,
  },
  stock_adjustment_investigate_needed: {
    icon: ClipboardList,
    status: 'needs-action',
    getHref: stockAdjustmentHref,
  },
  stock_adjustment_approval_needed: {
    icon: ClipboardList,
    status: 'needs-action',
    getHref: stockAdjustmentHref,
  },
  stock_adjustment_resolved: {
    icon: ClipboardList,
    status: 'resolved',
    getHref: stockAdjustmentHref,
  },
}

/**
 * A resolved notification's item won't be on the destination page's default
 * (Pending) view — it's already been actioned — so route straight to
 * History instead of dropping the user somewhere the item can't be found.
 * Destination pages that don't have a History tab (most of the catalog
 * today) simply ignore the extra query param.
 */
export function getNotificationHref(notification: {
  eventType: NotificationType
  entityId: string
}): string {
  const meta = NOTIFICATION_TYPE_META[notification.eventType]
  const base = meta.getHref(notification.entityId)
  if (meta.status !== 'resolved') return base
  // stockAdjustmentHref already carries its own `?tab=adjustments` — a bare
  // `?tab=history` suffix would produce a second, malformed `?` in the URL.
  // `&` is always correct once a query string already exists; a repeated
  // `tab` key is harmless (URLSearchParams.get() returns the first match,
  // so the real tab value still wins over the appended one).
  return base.includes('?') ? `${base}&tab=history` : `${base}?tab=history`
}

/**
 * A *_resolved eventType covers both approve and reject outcomes — the
 * eventType alone can't distinguish them, so approve()/reject() stamp
 * `metadata: { approved: boolean }` on the notification (see
 * release-form-requests.service.ts / return-refund-requests.service.ts).
 * Anything else (an unresolved/no-metadata notification, or a future
 * *_resolved type that hasn't been wired to set it yet) falls back to the
 * type's default status rather than guessing.
 */
export function resolveNotificationStatus(notification: NotificationItem): NotificationStatus {
  const meta = NOTIFICATION_TYPE_META[notification.eventType]
  if (meta.status !== 'resolved') return meta.status
  const metadata = notification.metadata
  const approved =
    metadata && typeof metadata === 'object' && 'approved' in metadata
      ? (metadata as { approved: unknown }).approved
      : undefined
  return approved === false ? 'rejected' : 'resolved'
}
