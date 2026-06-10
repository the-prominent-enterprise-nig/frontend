import { z } from 'zod'
import { LeadStatusEnum } from './types'

export const createLeadSchema = z.object({
  tenantId: z.string().min(1, 'Enterprise Owner is required'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().max(100).optional().or(z.literal('')),
  company: z.string().max(255).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  sourceChannel: z.string().max(100).optional().or(z.literal('')),
  stageId: z.string().uuid('Pipeline stage is required'),
  estimatedValue: z.coerce.number().min(0).optional(),
  assignedTo: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  status: LeadStatusEnum.optional(),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>

export const updateLeadSchema = createLeadSchema.partial()
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>

export const convertLeadSchema = z.object({
  customerCode: z
    .string()
    .min(1, 'Customer code is required')
    .max(20, 'Customer code must be at most 20 characters'),
  customerName: z.string().max(255).optional().or(z.literal('')),
})
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>
