import { z } from 'zod'

export const HolidayTypeSchema = z.enum(['Regular', 'SpecialNonWorking', 'Company', 'Branch'])
export const HolidayScopeSchema = z.enum(['Enterprise', 'BranchOnly'])

export type HolidayType = z.infer<typeof HolidayTypeSchema>
export type HolidayScope = z.infer<typeof HolidayScopeSchema>

export const HolidaySchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(),
  type: HolidayTypeSchema,
  scope: HolidayScopeSchema,
  branchId: z.string().nullable().optional(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  payWhenWorkedMultiplier: z.number(),
  payWhenNotWorkedMultiplier: z.number(),
  affectsLeaveCount: z.boolean(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean(),
  enterpriseOwnerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Holiday = z.infer<typeof HolidaySchema>

export const HolidayArraySchema = z.array(HolidaySchema)

export const CreateHolidaySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  date: z.string().min(1, 'Date is required'),
  type: HolidayTypeSchema.optional(),
  scope: HolidayScopeSchema.optional(),
  branchId: z.string().nullable().optional(),
  payWhenWorkedMultiplier: z.number().min(0).optional(),
  payWhenNotWorkedMultiplier: z.number().min(0).optional(),
  affectsLeaveCount: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type CreateHolidayInput = z.infer<typeof CreateHolidaySchema>
export type UpdateHolidayInput = Partial<CreateHolidayInput>

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  Regular: 'Regular Holiday',
  SpecialNonWorking: 'Special Non-Working',
  Company: 'Company Holiday',
  Branch: 'Branch Holiday',
}

export const HOLIDAY_SCOPE_LABELS: Record<HolidayScope, string> = {
  Enterprise: 'Enterprise-wide',
  BranchOnly: 'Branch-specific',
}
