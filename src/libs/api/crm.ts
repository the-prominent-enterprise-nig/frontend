import { api } from './client'
import type {
  PipelineStage,
  Lead,
  Customer,
  Interaction,
  Reminder,
  CustomerSegment,
  PipelineColumn,
  PaginatedResponse,
  Collector,
  CollectorDetail,
  CollectorRemittance,
  InstallmentAccount,
  InstallmentAccountDetail,
  AccountingCustomerLite,
  Agent,
  CollectionIncentive,
} from '@/src/schema/crm/types'
import type { CreateLeadInput, UpdateLeadInput, ConvertLeadInput } from '@/src/schema/crm/lead'
import type { CreateCustomerInput, UpdateCustomerInput } from '@/src/schema/crm/customer'
import type { CreateInteractionInput } from '@/src/schema/crm/interaction'
import type { CreateReminderInput, UpdateReminderInput } from '@/src/schema/crm/reminder'
import type {
  CreateCollectorInput,
  UpdateCollectorInput,
  CreateRemittanceInput,
} from '@/src/schema/crm/collector'
import type {
  CreateInstallmentAccountInput,
  UpdateInstallmentAccountInput,
  EarlyPayoffInput,
  RecordPaymentInput,
} from '@/src/schema/crm/installment-account'
import type { CreateAgentInput, UpdateAgentInput } from '@/src/schema/crm/agent'
import type { InstallmentSchedule } from '@/src/schema/pos'
import type {
  CreateCollectionIncentiveInput,
  RejectCollectionIncentiveInput,
} from '@/src/schema/crm/collection-incentive'
import type { PriceCheckInput, PriceCheckResult } from '@/src/schema/crm/installment-account'

// ─── Pipeline Stages ────────────────────────────────────────

export const pipelineStagesApi = {
  list: (tenantId?: string) =>
    api.get<PipelineStage[]>('/crm/pipeline-stages', tenantId ? { tenantId } : undefined, {
      tags: ['crm:pipeline-stages'],
    }),
  get: (id: string) => api.get<PipelineStage>(`/crm/pipeline-stages/${id}`),
  create: (body: Omit<PipelineStage, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<PipelineStage>('/crm/pipeline-stages', body),
  update: (id: string, body: Partial<PipelineStage>) =>
    api.patch<PipelineStage>(`/crm/pipeline-stages/${id}`, body),
  remove: (id: string) => api.delete(`/crm/pipeline-stages/${id}`),
}

// ─── Leads ──────────────────────────────────────────────────

export type LeadFilters = {
  search?: string
  status?: string
  stageId?: string
  assignedTo?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export const leadsApi = {
  list: (filters?: LeadFilters) =>
    api.get<PaginatedResponse<Lead>>('/crm/leads', filters, {
      tags: ['crm:leads'],
    }),
  pipeline: (tenantId?: string) =>
    api.get<PipelineColumn[]>('/crm/leads/pipeline', tenantId ? { tenantId } : undefined, {
      tags: ['crm:pipeline'],
    }),
  get: (id: string) =>
    api.get<Lead & { stage: PipelineStage; interactions: Interaction[]; reminders: Reminder[] }>(
      `/crm/leads/${id}`
    ),
  create: (body: CreateLeadInput) => api.post<Lead>('/crm/leads', body),
  update: (id: string, body: UpdateLeadInput) => api.patch<Lead>(`/crm/leads/${id}`, body),
  remove: (id: string) => api.delete(`/crm/leads/${id}`),
  assign: (id: string, assignedTo: string) =>
    api.post<Lead>(`/crm/leads/${id}/assign`, { assignedTo }),
  bulkAssign: (leadIds: string[], assignedTo: string) =>
    api.post<{ count: number }>('/crm/leads/bulk-assign', { leadIds, assignedTo }),
  convert: (id: string, body: ConvertLeadInput) =>
    api.post<{ lead: Lead; customer: Customer }>(`/crm/leads/${id}/convert`, body),
}

// ─── Customers ──────────────────────────────────────────────

export type CustomerFilters = {
  search?: string
  status?: string
  sourceChannel?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export const customersApi = {
  list: (filters?: CustomerFilters) =>
    api.get<PaginatedResponse<Customer>>('/crm/customers', filters, {
      tags: ['crm:customers'],
    }),
  get: (id: string) => api.get<Customer>(`/crm/customers/${id}`),
  get360: (id: string) =>
    api.get<
      Customer & {
        leads: Lead[]
        interactions: Interaction[]
        reminders: Reminder[]
      }
    >(`/crm/customers/${id}/360`),
  create: (body: CreateCustomerInput) => api.post<Customer>('/crm/customers', body),
  update: (id: string, body: UpdateCustomerInput) =>
    api.patch<Customer>(`/crm/customers/${id}`, body),
  getInstallmentSchedules: (id: string) =>
    api.get<InstallmentSchedule[]>(`/pos/customers/${id}/installment-schedules`),
  remove: (id: string) => api.delete(`/crm/customers/${id}`),
}

// ─── Interactions ───────────────────────────────────────────

export type InteractionFilters = {
  customerId?: string
  leadId?: string
  interactionType?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export const interactionsApi = {
  list: (filters?: InteractionFilters) =>
    api.get<PaginatedResponse<Interaction>>('/crm/interactions', filters),
  create: (body: CreateInteractionInput) => api.post<Interaction>('/crm/interactions', body),
  remove: (id: string) => api.delete(`/crm/interactions/${id}`),
}

// ─── Reminders ──────────────────────────────────────────────

export type ReminderFilters = {
  assignedTo?: string
  status?: string
  customerId?: string
  leadId?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export const remindersApi = {
  list: (filters?: ReminderFilters) =>
    api.get<PaginatedResponse<Reminder>>('/crm/reminders', filters),
  mine: (userId: string) => api.get<Reminder[]>('/crm/reminders/mine', { userId }),
  create: (body: CreateReminderInput) => api.post<Reminder>('/crm/reminders', body),
  update: (id: string, body: UpdateReminderInput) =>
    api.patch<Reminder>(`/crm/reminders/${id}`, body),
  complete: (id: string) => api.post<Reminder>(`/crm/reminders/${id}/complete`),
  remove: (id: string) => api.delete(`/crm/reminders/${id}`),
}

// ─── Collectors ─────────────────────────────────────────────

export type CollectorFilters = {
  search?: string
  branchId?: string
  status?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export const collectorsApi = {
  list: (filters?: CollectorFilters) =>
    api.get<PaginatedResponse<Collector>>('/crm/collectors', filters, {
      tags: ['crm:collectors'],
    }),
  get: (id: string) => api.get<CollectorDetail>(`/crm/collectors/${id}`),
  create: (body: CreateCollectorInput) => api.post<Collector>('/crm/collectors', body),
  update: (id: string, body: UpdateCollectorInput) =>
    api.patch<Collector>(`/crm/collectors/${id}`, body),
  remove: (id: string) => api.delete(`/crm/collectors/${id}`),
  remit: (id: string, body: CreateRemittanceInput) =>
    api.post<CollectorRemittance>(`/crm/collectors/${id}/remittances`, body),
}

// ─── Installment Accounts ───────────────────────────────────

export type InstallmentAccountFilters = {
  search?: string
  branchId?: string
  collectorId?: string
  category?: string
  classification?: string
  status?: string
  agingBucket?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export const installmentAccountsApi = {
  list: (filters?: InstallmentAccountFilters) =>
    api.get<PaginatedResponse<InstallmentAccount>>('/crm/installment-accounts', filters, {
      tags: ['crm:installment-accounts'],
    }),
  get: (id: string) => api.get<InstallmentAccountDetail>(`/crm/installment-accounts/${id}`),
  create: (body: CreateInstallmentAccountInput) =>
    api.post<InstallmentAccountDetail>('/crm/installment-accounts', body),
  update: (id: string, body: UpdateInstallmentAccountInput) =>
    api.patch<InstallmentAccountDetail>(`/crm/installment-accounts/${id}`, body),
  remove: (id: string) => api.delete(`/crm/installment-accounts/${id}`),
  earlyPayoff: (id: string, body: EarlyPayoffInput) =>
    api.post<InstallmentAccountDetail>(`/crm/installment-accounts/${id}/early-payoff`, body),
  recordPayment: (id: string, body: RecordPaymentInput) =>
    api.post<InstallmentAccountDetail & { pointEarned: boolean }>(
      `/crm/installment-accounts/${id}/payments`,
      body
    ),
}

// ─── Accounting Customers (used to link installment accounts) ──

export const accountingCustomersApi = {
  search: (search?: string) =>
    api.get<AccountingCustomerLite[]>('/customers', search ? { search } : undefined),
}

// ─── Customer Segments ──────────────────────────────────────

export const segmentsApi = {
  list: (tenantId?: string) =>
    api.get<CustomerSegment[]>('/crm/customer-segments', tenantId ? { tenantId } : undefined),
  get: (id: string) => api.get<CustomerSegment>(`/crm/customer-segments/${id}`),
  members: (id: string) => api.get<Customer[]>(`/crm/customer-segments/${id}/members`),
  create: (
    body: Omit<
      CustomerSegment,
      'id' | 'memberCount' | 'lastRefreshedAt' | 'createdAt' | 'updatedAt'
    >
  ) => api.post<CustomerSegment>('/crm/customer-segments', body),
  update: (id: string, body: Partial<CustomerSegment>) =>
    api.patch<CustomerSegment>(`/crm/customer-segments/${id}`, body),
  refresh: (id: string) => api.post<CustomerSegment>(`/crm/customer-segments/${id}/refresh`),
  remove: (id: string) => api.delete(`/crm/customer-segments/${id}`),
}

// ─── Sales Agents ───────────────────────────────────────────

export type AgentFilters = {
  search?: string
  status?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export const agentsApi = {
  list: (filters?: AgentFilters) =>
    api.get<PaginatedResponse<Agent>>('/crm/agents', filters, {
      tags: ['crm:agents'],
    }),
  get: (id: string) => api.get<Agent>(`/crm/agents/${id}`),
  create: (body: CreateAgentInput) => api.post<Agent>('/crm/agents', body),
  update: (id: string, body: UpdateAgentInput) => api.patch<Agent>(`/crm/agents/${id}`, body),
  remove: (id: string) => api.delete(`/crm/agents/${id}`),
}

// ─── Collection Incentives ──────────────────────────────────

export type CollectionIncentiveFilters = {
  collectorId?: string
  branchId?: string
  period?: string
  status?: string
  page?: number
  limit?: number
} & Record<string, string | number | boolean | undefined>

export const collectionIncentivesApi = {
  list: (filters?: CollectionIncentiveFilters) =>
    api.get<PaginatedResponse<CollectionIncentive>>('/crm/collection-incentives', filters, {
      tags: ['crm:collection-incentives'],
    }),
  get: (id: string) => api.get<CollectionIncentive>(`/crm/collection-incentives/${id}`),
  create: (body: CreateCollectionIncentiveInput) =>
    api.post<CollectionIncentive>('/crm/collection-incentives', body),
  remove: (id: string) => api.delete(`/crm/collection-incentives/${id}`),
  approve: (id: string) =>
    api.post<CollectionIncentive>(`/crm/collection-incentives/${id}/approve`),
  reject: (id: string, body: RejectCollectionIncentiveInput) =>
    api.post<CollectionIncentive>(`/crm/collection-incentives/${id}/reject`, body),
}

// ─── Installment Price Checker ──────────────────────────────

export const priceCheckApi = {
  check: (params: PriceCheckInput) =>
    api.get<PriceCheckResult>('/crm/installment-accounts/price-check', params),
}
