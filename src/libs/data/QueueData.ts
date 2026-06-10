import { api } from '@/src/libs/api/client'

export type QueueTicketStatus = 'WAITING' | 'CALLED' | 'SERVED' | 'CANCELLED'

export interface QueueCategory {
  id: string
  name: string
  branchId?: string | null
  description?: string | null
  counterName?: string | null
  visibility: boolean
  createdAt: string
  updatedAt: string
}

export interface QueueTicket {
  id: string
  categoryId: string
  number: number
  status: QueueTicketStatus
  priority: number
  customerName?: string | null
  customerId?: string | null
  salesOrderId?: string | null
  posTransactionId?: string | null
  issuedAt: string
  calledAt?: string | null
  servedAt?: string | null
  notes?: string | null
}

export interface QueueStats {
  issuedToday: number
  nowServing: number
  waiting: number
  avgServiceSec: number
  estimatedWaitSecPerPosition: number
}

export interface HourlyReportRow {
  hour: string
  issued: number
  served: number
  avgWaitSec: number
}

const TAGS = { all: 'queue-categories' }

export const QueueCategories = {
  list: (branchId?: string) =>
    api.get<QueueCategory[]>('/queue-management/categories', branchId ? { branchId } : undefined, {
      tags: [TAGS.all],
    }),
  get: (id: string) => api.get<QueueCategory>(`/queue-management/categories/${id}`),
  create: (data: Partial<QueueCategory>) =>
    api.post<QueueCategory>('/queue-management/categories', data),
  update: (id: string, data: Partial<QueueCategory>) =>
    api.patch<QueueCategory>(`/queue-management/categories/${id}`, data),
  remove: (id: string) => api.delete(`/queue-management/categories/${id}`),
}

export const QueueTickets = {
  list: (categoryId: string) =>
    api.get<QueueTicket[]>(`/queue-management/categories/${categoryId}/tickets`),
  issue: (
    categoryId: string,
    body: {
      count?: number
      customerName?: string
      customerId?: string
      salesOrderId?: string
      notes?: string
    }
  ) =>
    api.post<{ categoryId: string; tickets: { id: string; number: number }[] }>(
      `/queue-management/categories/${categoryId}/tickets`,
      body
    ),
  next: (categoryId: string) =>
    api.post<{ ok: true; ticket: QueueTicket } | { ok: false; reason: string }>(
      `/queue-management/categories/${categoryId}/next`
    ),
  prev: (categoryId: string) =>
    api.post<{ ok: true; ticket: QueueTicket } | { ok: false; reason: string }>(
      `/queue-management/categories/${categoryId}/prev`
    ),
  call: (ticketId: string) => api.post<QueueTicket>(`/queue-management/tickets/${ticketId}/call`),
  serve: (ticketId: string) => api.post<QueueTicket>(`/queue-management/tickets/${ticketId}/serve`),
  cancel: (ticketId: string) =>
    api.post<QueueTicket>(`/queue-management/tickets/${ticketId}/cancel`),
  attachSales: (ticketId: string, data: { salesOrderId?: string; posTransactionId?: string }) =>
    api.patch<QueueTicket>(`/queue-management/tickets/${ticketId}/attach-sales`, data),
  reset: (categoryId: string) => api.post(`/queue-management/categories/${categoryId}/reset`),
}

export const QueueStatsAPI = {
  get: (categoryId?: string) =>
    api.get<QueueStats>('/queue-management/stats', categoryId ? { categoryId } : undefined),
  hourly: (startDate: string, endDate: string) =>
    api.get<HourlyReportRow[]>('/queue-management/reports/hourly', { startDate, endDate }),
}

export function fmtWait(seconds: number): string {
  if (!seconds || seconds < 60) return `${Math.max(0, Math.round(seconds))}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s ? `${m}m ${s}s` : `${m}m`
}
