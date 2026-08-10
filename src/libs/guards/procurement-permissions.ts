// Scenario 22 Part 9 follow-up: Procurement was folded into the Inventory
// permission module — these permission strings are now `inventory:*`, not
// `procurement:*` (the underlying routes/pages this file gates already
// live under Inventory, e.g. /inventory/purchase-orders, /inventory/suppliers
// — the permission module just hadn't caught up until now). Kept as its
// own named export (not merged into inventory-permissions.ts) since PR/PO/
// Suppliers/Quotas are still a distinct feature area worth naming clearly,
// even though they're no longer a distinct RBAC module.
export const PROCUREMENT_PERMISSIONS = {
  SUPPLIERS_READ: 'inventory:suppliers:read',
  SUPPLIERS_CREATE: 'inventory:suppliers:create',
  SUPPLIERS_UPDATE: 'inventory:suppliers:update',
  SUPPLIERS_DELETE: 'inventory:suppliers:delete',
  SUPPLIERS_MANAGE_DOCUMENTS: 'inventory:suppliers:manage_documents',
  PR_READ: 'inventory:purchase-requests:read',
  PR_CREATE: 'inventory:purchase-requests:create',
  PR_APPROVE: 'inventory:purchase-requests:approve',
  PR_REJECT: 'inventory:purchase-requests:reject',
  PR_CANCEL: 'inventory:purchase-requests:cancel',
  PR_UPDATE: 'inventory:purchase-requests:update',
  PO_READ: 'inventory:purchase-orders:read',
  PO_CREATE: 'inventory:purchase-orders:create',
  PO_UPDATE: 'inventory:purchase-orders:update',
  PO_APPROVE: 'inventory:purchase-orders:approve',
  PO_SEND: 'inventory:purchase-orders:send',
  PO_CLOSE: 'inventory:purchase-orders:close',
  PO_CANCEL: 'inventory:purchase-orders:cancel',
  // Not currently enforced by any backend route (goods receiving actually
  // runs through /inventory/stock/receive, gated by inventory:receive:*) —
  // pre-existing gap, not introduced or fixed by this rename.
  GR_READ: 'inventory:goods-receipts:read',
  GR_CREATE: 'inventory:goods-receipts:create',
  QUOTA_READ: 'inventory:quotas:read',
  QUOTA_MANAGE: 'inventory:quotas:manage',
  WILDCARD: 'inventory:*',
} as const

export type ProcurementPermission =
  (typeof PROCUREMENT_PERMISSIONS)[keyof typeof PROCUREMENT_PERMISSIONS]
