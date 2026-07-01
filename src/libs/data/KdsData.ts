import { api } from '@/src/libs/api/client'

export type KdsOrderStatus = 'WAITING' | 'CALLED' | 'SERVED' | 'CANCELLED'

export interface KdsLine {
  id: string
  itemId: string
  itemName: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface KdsOrder {
  id: string
  number: number
  status: KdsOrderStatus
  priority: number
  customerName: string | null
  salesOrderId?: string | null
  issuedAt: string
  calledAt: string | null
  servedAt: string | null
  notes: string | null
  category: { id: string; name: string; branchId: string | null }
  transaction: {
    id: string
    transactionNumber: string
    totalAmount: number
    occurredAt: string
    lines: KdsLine[]
    session: {
      terminal: { name: string }
      cashier: { id: string; name: string }
    }
  } | null
}

export const KdsApi = {
  listOrders: (params?: {
    categoryId?: string
    branchId?: string
    statuses?: KdsOrderStatus[]
  }) => {
    const { statuses, ...rest } = params ?? {}
    const serialized: Record<string, string | undefined> = { ...rest }
    if (statuses?.length) serialized.statuses = statuses.join(',')
    return api.get<{ data: KdsOrder[]; meta: { total: number } }>('/pos/kds/orders', serialized)
  },

  callOrder: (ticketId: string) =>
    api.patch<{ data: KdsOrder; meta: object }>(`/pos/kds/orders/${ticketId}/call`, {}),

  serveOrder: (ticketId: string) =>
    api.patch<{ data: KdsOrder; meta: object }>(`/pos/kds/orders/${ticketId}/serve`, {}),

  cancelOrder: (ticketId: string) =>
    api.patch<{ data: KdsOrder; meta: object }>(`/pos/kds/orders/${ticketId}/cancel`, {}),
}
