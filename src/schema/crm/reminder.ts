import { z } from 'zod'
import { ReminderTypeEnum, ReminderStatusEnum } from './types'

export const createReminderSchema = z
  .object({
    tenantId: z.string().min(1),
    customerId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    installmentAccountId: z.string().uuid().optional(),
    collectorId: z.string().uuid().optional(),
    assignedTo: z.string().min(1, 'Assignee is required'),
    reminderType: ReminderTypeEnum,
    dueAt: z.string().min(1, 'Due date is required'),
    note: z.string().max(1000).optional().or(z.literal('')),
  })
  .refine((d) => Boolean(d.customerId || d.leadId || d.installmentAccountId), {
    message: 'Either customerId, leadId, or installmentAccountId is required',
    path: ['customerId'],
  })

export type CreateReminderInput = z.infer<typeof createReminderSchema>

export const updateReminderSchema = z.object({
  reminderType: ReminderTypeEnum.optional(),
  dueAt: z.string().optional(),
  note: z.string().max(1000).optional().or(z.literal('')),
  status: ReminderStatusEnum.optional(),
})
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>

export const completeReminderSchema = z.object({
  outcome: z.string().max(1000).optional().or(z.literal('')),
  contactPhone: z.string().max(20).optional().or(z.literal('')),
})
export type CompleteReminderInput = z.infer<typeof completeReminderSchema>
