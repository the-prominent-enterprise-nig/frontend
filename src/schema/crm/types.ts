import { z } from 'zod'

export const LeadStatusEnum = z.enum(['active', 'won', 'lost', 'archived'])
export type LeadStatus = z.infer<typeof LeadStatusEnum>

export const CustomerSourceChannelEnum = z.enum(['pos_walkin', 'sales', 'crm_lead', 'online'])
export type CustomerSourceChannel = z.infer<typeof CustomerSourceChannelEnum>

export const CustomerStatusEnum = z.enum(['active', 'inactive', 'blocked'])
export type CustomerStatus = z.infer<typeof CustomerStatusEnum>

export const CustomerTypeEnum = z.enum(['individual', 'business'])
export type CustomerType = z.infer<typeof CustomerTypeEnum>

export const InteractionTypeEnum = z.enum(['call', 'email', 'meeting', 'visit', 'message', 'other'])
export type InteractionType = z.infer<typeof InteractionTypeEnum>

export const ReminderTypeEnum = z.enum(['call', 'email', 'visit', 'other'])
export type ReminderType = z.infer<typeof ReminderTypeEnum>

export const ReminderStatusEnum = z.enum(['pending', 'completed', 'overdue', 'cancelled'])
export type ReminderStatus = z.infer<typeof ReminderStatusEnum>

export interface PipelineStage {
  id: string
  tenantId: string
  name: string
  orderIndex: number
  isWonStage: boolean
  isLostStage: boolean
  createdAt: string
  updatedAt: string
}

export interface Lead {
  id: string
  tenantId: string
  firstName: string
  lastName?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  sourceChannel?: string | null
  stageId: string
  estimatedValue?: number | string | null
  assignedTo?: string | null
  convertedToCustomerId?: string | null
  notes?: string | null
  status: LeadStatus
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: string
  tenantId: string
  customerCode: string
  name: string
  customerType: CustomerType
  companyName?: string | null
  taxId?: string | null
  isTaxExempt: boolean
  taxExemptionRef?: string | null
  email?: string | null
  phone?: string | null
  billingAddress?: string | null
  shippingAddress?: string | null
  paymentTerms?: string | null
  creditLimit?: number | string | null
  sourceChannel: CustomerSourceChannel
  status: CustomerStatus
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Interaction {
  id: string
  tenantId: string
  customerId?: string | null
  leadId?: string | null
  interactionType: InteractionType
  summary: string
  outcome?: string | null
  loggedBy: string
  occurredAt: string
  createdAt: string
}

export interface Reminder {
  id: string
  tenantId: string
  customerId?: string | null
  leadId?: string | null
  assignedTo: string
  reminderType: ReminderType
  dueAt: string
  note?: string | null
  status: ReminderStatus
  completedAt?: string | null
  isOverdue?: boolean
  createdAt: string
}

export interface CustomerSegment {
  id: string
  tenantId: string
  name: string
  description?: string | null
  ruleDefinition: Record<string, unknown>
  memberCount: number
  lastRefreshedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface PipelineColumn {
  stageId: string
  stageName: string
  isWonStage?: boolean
  isLostStage?: boolean
  leadCount: number
  totalValue: number
  leads: Lead[]
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
