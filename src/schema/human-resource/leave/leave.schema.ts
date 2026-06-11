import { z } from 'zod'

export const leaveApprovalSchema = z.object({
  leaveRequestId: z.string(),
  decision: z.enum(['Approved', 'Rejected']),
  remarks: z.string().optional(),
})

export const leaveAdjustmentSchema = z.object({
  employeeId: z.string(),
  leaveTypeId: z.string(),
  adjustment: z.number(),
  reason: z.string().optional(),
  updatedBy: z.string(),
  effectiveImmediately: z.boolean().optional(),
})

export const submitLeaveRequestSchema = z.object({
  employeeId: z.string(),
  leaveTypeId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

export const myLeaveRequestSchema = z.object({
  leaveTypeId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  supportingAttachment: z.string().optional(),
})
