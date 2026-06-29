import { api } from './client'
import type {
  GoodsReceipt,
  GoodsReceiptStatus,
  PaginatedResponse,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseRequest,
  PurchaseRequestStatus,
} from '@/src/schema/procurement/types'

// ─── Purchase Requests ──────────────────────────────────────

export type PrFilters = {
  search?: string
  status?: PurchaseRequestStatus
  requestedById?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export type CreatePrInput = {
  tenantId: string
  code: string
  requestedById: string
  branchId?: string
  reason?: string
  notes?: string
  lines: Array<{
    itemId: string
    quantity: number
    suggestedSupplierId?: string
    notes?: string
  }>
}

export const purchaseRequestsApi = {
  list: (filters?: PrFilters) =>
    api.get<PaginatedResponse<PurchaseRequest>>('/procurement/purchase-requests', filters),
  get: (id: string) => api.get<PurchaseRequest>(`/procurement/purchase-requests/${id}`),
  create: (body: CreatePrInput) =>
    api.post<PurchaseRequest>('/procurement/purchase-requests', body),
  approve: (id: string, approvedById: string) =>
    api.post<PurchaseRequest>(`/procurement/purchase-requests/${id}/approve`, { approvedById }),
  reject: (id: string, reason: string) =>
    api.post<PurchaseRequest>(`/procurement/purchase-requests/${id}/reject`, { reason }),
  cancel: (id: string) => api.delete<PurchaseRequest>(`/procurement/purchase-requests/${id}`),
  sweepReorder: (tenantId: string, triggeredByUserId: string) =>
    api.post<{
      sweptRules: number
      triggered: Array<{ itemId: string; sku: string; prId: string }>
      skipped: Array<{ itemId: string; sku: string; reason: string }>
    }>('/procurement/purchase-requests/sweep-reorder', {
      tenantId,
      triggeredByUserId,
    }),
}

// ─── Purchase Orders ────────────────────────────────────────

export type PoFilters = {
  search?: string
  status?: PurchaseOrderStatus
  supplierId?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export type CreatePoInput = {
  tenantId: string
  code: string
  supplierId: string
  branchId?: string
  warehouseId?: string
  expectedDeliveryDate?: string
  currency?: string
  paymentTerms?: string
  shippingAddress?: string
  notes?: string
  lines: Array<{
    itemId: string
    quantity: number
    unitPrice: number
    notes?: string
  }>
}

export type ConvertFromPrInput = {
  purchaseRequestId: string
  code: string
  supplierId: string
  warehouseId?: string
  expectedDeliveryDate?: string
  unitPricesByItemId: Record<string, number>
}

export const purchaseOrdersApi = {
  list: (filters?: PoFilters) =>
    api.get<PaginatedResponse<PurchaseOrder>>('/procurement/purchase-orders', filters),
  get: (id: string) => api.get<PurchaseOrder>(`/procurement/purchase-orders/${id}`),
  create: (body: CreatePoInput) => api.post<PurchaseOrder>('/procurement/purchase-orders', body),
  convertFromPr: (body: ConvertFromPrInput) =>
    api.post<PurchaseOrder>('/procurement/purchase-orders/convert-from-pr', body),
  send: (id: string) => api.post<PurchaseOrder>(`/procurement/purchase-orders/${id}/send`),
  close: (id: string) => api.post<PurchaseOrder>(`/procurement/purchase-orders/${id}/close`),
  cancel: (id: string) => api.delete<PurchaseOrder>(`/procurement/purchase-orders/${id}`),
}

// ─── Goods Receipts ─────────────────────────────────────────

export type GrFilters = {
  search?: string
  status?: GoodsReceiptStatus
  purchaseOrderId?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export type CreateGrInput = {
  tenantId: string
  code: string
  purchaseOrderId: string
  warehouseId: string
  receivedById: string
  status?: GoodsReceiptStatus
  notes?: string
  lines: Array<{
    itemId: string
    quantityReceived: number
    batchNumber?: string
    expiryDate?: string
    serialNumbers?: string[]
    qualityHold?: boolean
    notes?: string
  }>
}

export const goodsReceiptsApi = {
  list: (filters?: GrFilters) =>
    api.get<PaginatedResponse<GoodsReceipt>>('/procurement/goods-receipts', filters),
  get: (id: string) => api.get<GoodsReceipt>(`/procurement/goods-receipts/${id}`),
  create: (body: CreateGrInput) => api.post<GoodsReceipt>('/procurement/goods-receipts', body),
}
