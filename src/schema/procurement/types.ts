export type PurchaseRequestStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'converted'

export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'partially_received'
  | 'received'
  | 'closed'
  | 'cancelled'

export type GoodsReceiptStatus = 'draft' | 'received' | 'posted' | 'cancelled'

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    lastPage: number
  }
}

export interface PurchaseRequest {
  id: string
  tenantId: string
  code: string
  requestedById: string
  branchId?: string | null
  reason?: string | null
  notes?: string | null
  status: PurchaseRequestStatus
  lines: Array<{
    id: string
    itemId: string
    quantity: number
    suggestedSupplierId?: string | null
    notes?: string | null
  }>
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrder {
  id: string
  tenantId: string
  code: string
  supplierId: string
  supplier?: { id: string; name: string } | null
  branchId?: string | null
  warehouseId?: string | null
  orderDate?: string | null
  expectedDeliveryDate?: string | null
  currency?: string | null
  paymentTerms?: string | null
  shippingAddress?: string | null
  notes?: string | null
  status: PurchaseOrderStatus
  lines: Array<{
    id: string
    itemId: string
    item?: { id: string; name: string; sku: string } | null
    quantity: number
    receivedQuantity?: number | null
    unitPrice: number
    notes?: string | null
  }>
  createdAt: string
  updatedAt: string
}

export interface GoodsReceipt {
  id: string
  tenantId: string
  code: string
  purchaseOrderId: string
  warehouseId: string
  receivedById: string
  applicationType: 'new_stock' | 'revert'
  modeOfTransfer?: string | null
  nndpCost?: number | null
  receivedAt: string
  status: GoodsReceiptStatus
  notes?: string | null
  lines: Array<{
    id: string
    purchaseOrderLineId: string
    quantityReceived: number
    batchNumber?: string | null
    expiryDate?: string | null
    serialNumbers?: string[] | null
    qualityHold?: boolean | null
    notes?: string | null
  }>
  createdAt: string
  updatedAt: string
}
