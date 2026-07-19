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

export const CollectorStatusEnum = z.enum(['active', 'inactive'])
export type CollectorStatus = z.infer<typeof CollectorStatusEnum>

export const InstallmentAccountCategoryEnum = z.enum(['A', 'B', 'C'])
export type InstallmentAccountCategory = z.infer<typeof InstallmentAccountCategoryEnum>

export const InstallmentAccountClassificationEnum = z.enum(['official', 'arrears', 'not_moving'])
export type InstallmentAccountClassification = z.infer<typeof InstallmentAccountClassificationEnum>

export const InstallmentAccountStatusEnum = z.enum([
  'active',
  'closed',
  'early_closed',
  'written_off',
])
export type InstallmentAccountStatus = z.infer<typeof InstallmentAccountStatusEnum>

export const AgentStatusEnum = z.enum(['active', 'inactive'])
export type AgentStatus = z.infer<typeof AgentStatusEnum>

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

export interface Agent {
  id: string
  tenantId: string
  name: string
  phone?: string | null
  email?: string | null
  status: AgentStatus
  commissionRate?: number | null
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

export interface Collector {
  id: string
  stubNumber: string
  name: string
  branchId?: string | null
  userId?: string | null
  status: CollectorStatus
  createdAt: string
  updatedAt: string
}

export interface CollectorRemittance {
  id: string
  collectorId: string
  amount: number | string
  remittedAt: string
  cashierId?: string | null
  reference?: string | null
  notes?: string | null
  createdAt: string
}

export interface CollectorInstallmentAccountSummary {
  id: string
  accountNumber: string
  category?: InstallmentAccountCategory | null
  classification?: InstallmentAccountClassification | null
  agingBucket?: string | null
  currentBalance: number | string
}

export interface CollectorDetail extends Collector {
  branch?: { id: string; name: string; code: string } | null
  installmentAccounts: CollectorInstallmentAccountSummary[]
  remittances: CollectorRemittance[]
}

export interface AccountingCustomerLite {
  id: string
  name: string
  phone?: string | null
  email?: string | null
}

export interface InstallmentAccount {
  id: string
  accountNumber: string
  customerId: string
  branchId?: string | null
  collectorId?: string | null
  currentBalance: number | string
  category?: InstallmentAccountCategory | null
  classification?: InstallmentAccountClassification | null
  agingBucket?: string | null
  status: InstallmentAccountStatus
  createdAt: string
  customer?: { name: string } | null
  branch?: { name: string } | null
  collector?: { stubNumber: string; name: string } | null
}

export interface InstallmentAccountDetail extends InstallmentAccount {
  arInvoiceId?: string | null
  listedCashPrice: number | string
  downPayment: number | string
  amountFinanced: number | string
  termMonths: number
  miFactor: number | string
  monthlyInstallment: number | string
  pnv: number | string
  totalPrice: number | string
  interestDifferential: number | string
  ppd: number | string
  openingBalance: number | string
  dpBalance: number | string
  lastOrNumber?: string | null
  lastOrDate?: string | null
  lastOrAmount?: number | string | null
  notYetDue: number | string
  totalDue: number | string
  miDue: number | string
  uncollected: number | string
  arrears: number | string
  penalty: number | string
  monthsRun: number
  points: number
  noArsSince?: string | null
  notMovingSince?: string | null
  closedAt?: string | null
  updatedAt: string
  customer: AccountingCustomerLite
  branch?: { id: string; name: string; code: string } | null
  collector?: { id: string; stubNumber: string; name: string } | null
  arInvoice?: { id: string; invoiceNumber: string; status: string } | null
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
