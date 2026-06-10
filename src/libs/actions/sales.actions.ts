'use server'

import { api } from '@/src/libs/api/client'

// ─── Types ────────────────────────────────────────────────

export interface SalesLine {
  id: string
  itemName: string
  description: string | null
  quantity: string
  unitPrice: string
  taxRate: string
  totalPrice: string
  sortOrder: number
}

export interface Quotation {
  id: string
  enterpriseOwnerId: string
  quotationNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'
  issueDate: string
  expiryDate: string | null
  notes: string | null
  subtotal: string
  taxAmount: string
  totalAmount: string
  currency: string
  salesOrderId: string | null
  lines: SalesLine[]
  createdAt: string
  updatedAt: string
}

export interface SalesOrder {
  id: string
  enterpriseOwnerId: string
  orderNumber: string
  quotationId: string | null
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  status: 'draft' | 'confirmed' | 'processing' | 'delivered' | 'cancelled'
  orderDate: string
  expectedDelivery: string | null
  notes: string | null
  subtotal: string
  taxAmount: string
  totalAmount: string
  currency: string
  lines: SalesLine[]
  createdAt: string
  updatedAt: string
}

export interface SalesLineInput {
  itemName: string
  description?: string
  quantity: number
  unitPrice: number
  taxRate?: number
  sortOrder?: number
}

export interface CreateQuotationInput {
  customerName: string
  customerEmail?: string
  customerPhone?: string
  issueDate: string
  expiryDate?: string
  notes?: string
  currency?: string
  lines: SalesLineInput[]
}

export interface CreateSalesOrderInput {
  customerName: string
  customerEmail?: string
  customerPhone?: string
  orderDate: string
  expectedDelivery?: string
  notes?: string
  currency?: string
  lines: SalesLineInput[]
}

export interface SalesSummary {
  totalRevenue: string
  pendingOrders: number
  ordersToDeliver: number
  overdueInvoices: number
  activeCustomers: number
  totalQuotations: number
  convertedQuotations: number
  totalOrders: number
  openOrders: number
}

// ─── Actions ──────────────────────────────────────────────

export async function getSalesSummary() {
  const result = await api.get<SalesSummary>('/sales/summary')
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

export async function getQuotations(params?: {
  search?: string
  status?: string
  page?: number
  limit?: number
}) {
  const queryParams: Record<string, string | number> = {}
  if (params?.search) queryParams.search = params.search
  if (params?.status) queryParams.status = params.status
  if (params?.page) queryParams.page = params.page
  if (params?.limit) queryParams.limit = params.limit

  const result = await api.get<{ data: Quotation[]; total: number; page: number }>(
    '/sales/quotations',
    queryParams
  )
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

export async function createQuotation(input: CreateQuotationInput) {
  const result = await api.post<Quotation>('/sales/quotations', input)
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

export async function getOrders(params?: {
  search?: string
  status?: string
  page?: number
  limit?: number
}) {
  const queryParams: Record<string, string | number> = {}
  if (params?.search) queryParams.search = params.search
  if (params?.status) queryParams.status = params.status
  if (params?.page) queryParams.page = params.page
  if (params?.limit) queryParams.limit = params.limit

  const result = await api.get<{ data: SalesOrder[]; total: number; page: number }>(
    '/sales/orders',
    queryParams
  )
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

export async function createOrder(input: CreateSalesOrderInput) {
  const result = await api.post<SalesOrder>('/sales/orders', input)
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

export async function convertQuotationToOrder(quotationId: string) {
  const result = await api.post<SalesOrder>(`/sales/quotations/${quotationId}/convert-to-order`)
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

export async function updateQuotationStatus(quotationId: string, status: Quotation['status']) {
  const result = await api.patch<Quotation>(`/sales/quotations/${quotationId}`, { status })
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

export async function updateOrderStatus(orderId: string, status: SalesOrder['status']) {
  const result = await api.patch<SalesOrder>(`/sales/orders/${orderId}`, { status })
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}
