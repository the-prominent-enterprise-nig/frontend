export type PurchaseRequestStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'converted'
  | 'cancelled'

export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'partially_received'
  | 'fully_received'
  | 'closed'
  | 'cancelled'

export type GoodsReceiptStatus = 'draft' | 'received' | 'quality_hold' | 'rejected'

export interface PurchaseRequestLine {
  id: string
  purchaseRequestId: string
  itemId: string
  item?: { id: string; sku: string; name: string }
  quantity: number | string
  suggestedSupplierId?: string | null
  notes?: string | null
  createdAt: string
}

export interface PurchaseRequest {
  id: string
  tenantId: string
  code: string
  status: PurchaseRequestStatus
  requestedById: string
  branchId?: string | null
  reason?: string | null
  triggeredByReorder: boolean
  notes?: string | null
  approvedById?: string | null
  approvedAt?: string | null
  rejectedReason?: string | null
  convertedToPoId?: string | null
  createdAt: string
  updatedAt: string
  lines?: PurchaseRequestLine[]
}

export interface PurchaseOrderLine {
  id: string
  purchaseOrderId: string
  itemId: string
  item?: { id: string; sku: string; name: string }
  quantity: number | string
  unitPrice: number | string
  receivedQuantity: number | string
  lineTotal: number | string
  notes?: string | null
  createdAt: string
}

export interface PurchaseOrder {
  id: string
  tenantId: string
  code: string
  status: PurchaseOrderStatus
  supplierId: string
  supplier?: { id: string; code: string; name: string }
  branchId?: string | null
  warehouseId?: string | null
  orderDate: string
  expectedDeliveryDate?: string | null
  currency: string
  subtotalAmount: number | string
  taxAmount: number | string
  totalAmount: number | string
  paymentTerms?: string | null
  shippingAddress?: string | null
  notes?: string | null
  sentAt?: string | null
  closedAt?: string | null
  createdAt: string
  updatedAt: string
  fromPr?: { id: string; code: string } | null
  lines?: PurchaseOrderLine[]
}

export interface GoodsReceiptLine {
  id: string
  goodsReceiptId: string
  purchaseOrderLineId: string
  purchaseOrderLine?: {
    id: string
    itemId: string
    quantity: number | string
    unitPrice: number | string
    item: { id: string; sku: string; name: string }
  }
  quantityReceived: number | string
  batchNumber?: string | null
  expiryDate?: string | null
  serialNumbers: string[]
  qualityHold: boolean
  notes?: string | null
  createdAt: string
}

export interface GoodsReceipt {
  id: string
  tenantId: string
  code: string
  status: GoodsReceiptStatus
  purchaseOrderId: string
  purchaseOrder?: { id: string; code: string; supplierId?: string }
  warehouseId: string
  warehouse?: { id: string; code: string; name: string }
  receivedById: string
  receivedAt: string
  notes?: string | null
  createdAt: string
  updatedAt: string
  lines?: GoodsReceiptLine[]
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    lastPage: number
  }
}
