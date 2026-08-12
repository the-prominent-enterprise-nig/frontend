export type NotificationType =
  | 'pos_release_form_created'
  | 'pos_release_form_resolved'
  | 'pos_return_refund_created'
  | 'pos_return_refund_resolved'
  | 'inventory_low_stock'
  | 'ar_invoice_overdue'
  | 'credit_application_investigation_needed'
  | 'credit_application_approval_needed'
  | 'credit_application_resolved'
  | 'item_master_confirm_accounting_needed'
  | 'item_master_approval_needed'
  | 'item_master_resolved'
  | 'stock_adjustment_confirm_needed'
  | 'stock_adjustment_investigate_needed'
  | 'stock_adjustment_approval_needed'
  | 'stock_adjustment_resolved'

export interface NotificationItem {
  id: string
  eventType: NotificationType
  entityType: string
  entityId: string
  title: string
  message: string
  metadata: unknown
  branchId: string | null
  createdAt: string
  isRead: boolean
  readAt: string | null
}

export interface NotificationListResponse {
  data: NotificationItem[]
  total: number
  page: number
  limit: number
}

export interface UnreadCountResponse {
  count: number
}
