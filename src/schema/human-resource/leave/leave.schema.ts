import { z } from 'zod'

export enum LeaveRequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Cancelled = 'Cancelled',
}

// ─── Leave Type Schema ───
export const leaveTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Leave type name is required').max(100),
  code: z.string().min(1, 'Code is required').max(10),
  description: z.string().max(255).optional().or(z.literal('')),
  defaultYearlyAllocation: z.coerce.number().min(0, 'Must be non-negative'),
  isCarryoverAllowed: z.boolean().default(false),
  maxCarryoverDays: z.coerce.number().min(0).default(0),
  requiresAttachment: z.boolean().default(false),
  isPaidLeave: z.boolean().default(true),
  allowUnpaidIfZeroBalance: z.boolean().default(false),
  applicableGender: z.string().max(50).optional().or(z.literal('')),
  isGovernmentMandated: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>

// ─── Leave Request Schema ───
const leaveRequestBaseSchema = z.object({
  id: z.string().uuid().optional(),
  employeeId: z.string().uuid('Employee is required'),
  leaveTypeId: z.string().uuid('Leave type is required'),
  startDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  endDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  totalDaysRequested: z.coerce.number().positive('Must be at least 1 day'),
  reason: z.string().min(1, 'Reason is required').max(500),
  supportingAttachment: z.string().max(255).optional().or(z.literal('')),
  isUnpaidLeave: z.boolean().default(false),
})

const dateRefinement = {
  check: (data: { startDate: Date; endDate: Date }) => data.endDate >= data.startDate,
  message: {
    message: 'End date must be after or equal to start date',
    path: ['endDate'] as PropertyKey[],
  },
}

export const leaveRequestSchema = leaveRequestBaseSchema.refine(
  dateRefinement.check,
  dateRefinement.message
)

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>

// ─── Create Leave Request Schema (for submission) ───
export const createLeaveRequestSchema = leaveRequestBaseSchema
  .omit({ id: true })
  .refine(dateRefinement.check, dateRefinement.message)

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>

// ─── Leave Balance Schema ───
export const leaveBalanceSchema = z.object({
  id: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  year: z.coerce.number().min(2000).max(2100),
  allocatedDays: z.coerce.number().min(0),
  adjustedDays: z.coerce.number().default(0),
  usedDays: z.coerce.number().min(0).default(0),
  carryoverDays: z.coerce.number().min(0).default(0),
})

export type LeaveBalanceInput = z.infer<typeof leaveBalanceSchema>

// ─── Leave Approval Schema ───
export const leaveApprovalSchema = z.object({
  leaveRequestId: z.string().uuid('Leave request is required'),
  decision: z.enum(['Approved', 'Rejected']),
  remarks: z.string().max(500).optional().or(z.literal('')),
})

export type LeaveApprovalInput = z.infer<typeof leaveApprovalSchema>

// ─── Leave Adjustment Schema ───
export const leaveAdjustmentSchema = z.object({
  applyTo: z.enum(['Single Employee', 'Multiple Employees', 'All Employees']),
  selectedEmployeeId: z.string().optional(),
  selectedEmployeeIds: z.array(z.string()).optional(),
  leaveTypeId: z.string().uuid('Leave type is required'),
  year: z.coerce.number().min(2000).max(2100),
  adjustmentType: z.enum(['Add', 'Deduct', 'Set Balance']),
  adjustmentValue: z.coerce.number().min(0, 'Must be a non-negative number'),
  reason: z.string().min(1, 'Reason is required').max(500),
  updatedBy: z.string().min(1),
  effectiveImmediately: z.literal(true),
})

export type LeaveAdjustmentInput = z.input<typeof leaveAdjustmentSchema>

// ─── Leave Request Submission Schema (without ID) ───
export const submitLeaveRequestSchema = z
  .object({
    employeeId: z.string().uuid('Employee is required'),
    leaveTypeId: z.string().uuid('Leave type is required'),
    startDate: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    endDate: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    totalDaysRequested: z.coerce.number().positive('Must be at least 1 day'),
    reason: z.string().min(1, 'Reason is required').max(500),
    supportingAttachment: z.string().max(255).optional().or(z.literal('')),
    isUnpaidLeave: z.boolean().default(false),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  })

export type SubmitLeaveRequestInput = z.input<typeof submitLeaveRequestSchema>

// ─── My Leave Request Schema (workspace — no employeeId, no totalDaysRequested) ───
export const myLeaveRequestSchema = z
  .object({
    leaveTypeId: z.string().uuid('Leave type is required'),
    startDate: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    endDate: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    reason: z.string().min(1, 'Reason is required').max(500),
    supportingAttachment: z.string().max(255).optional().or(z.literal('')),
    isUnpaidLeave: z.boolean().default(false),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  })

export type MyLeaveRequestInput = z.input<typeof myLeaveRequestSchema>
