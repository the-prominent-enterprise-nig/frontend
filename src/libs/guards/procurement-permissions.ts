export const PROCUREMENT_PERMISSIONS = {
  SUPPLIERS_READ: 'procurement:suppliers:read',
  SUPPLIERS_CREATE: 'procurement:suppliers:create',
  SUPPLIERS_UPDATE: 'procurement:suppliers:update',
  SUPPLIERS_DELETE: 'procurement:suppliers:delete',
  SUPPLIERS_MANAGE_DOCUMENTS: 'procurement:suppliers:manage_documents',
  PR_READ: 'procurement:purchase-requests:read',
  PR_CREATE: 'procurement:purchase-requests:create',
  PR_APPROVE: 'procurement:purchase-requests:approve',
  PR_REJECT: 'procurement:purchase-requests:reject',
  PR_CANCEL: 'procurement:purchase-requests:cancel',
  PO_READ: 'procurement:purchase-orders:read',
  PO_CREATE: 'procurement:purchase-orders:create',
  PO_UPDATE: 'procurement:purchase-orders:update',
  PO_SEND: 'procurement:purchase-orders:send',
  PO_CLOSE: 'procurement:purchase-orders:close',
  PO_CANCEL: 'procurement:purchase-orders:cancel',
  GR_READ: 'procurement:goods-receipts:read',
  GR_CREATE: 'procurement:goods-receipts:create',
  WILDCARD: 'procurement:*',
} as const

export type ProcurementPermission =
  (typeof PROCUREMENT_PERMISSIONS)[keyof typeof PROCUREMENT_PERMISSIONS]
