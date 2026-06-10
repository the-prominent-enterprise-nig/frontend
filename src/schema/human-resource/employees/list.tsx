// types/employee.ts
import { z } from 'zod'

// Zod Schemas for validation
export const EmployeeStatusSchema = z.enum(['active', 'inactive', 'resigned', 'terminated'])
export const MaritalStatusSchema = z.enum(['Single', 'Married', 'Widowed', 'Separated'])
export const PayoutCycleSchema = z.enum(['FirstCycle', 'SecondCycle'])

// Nested schemas for related entities
export const DepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const PositionSchema = z.object({
  id: z.string(),
  title: z.string(),
})

export const BranchSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const EmployeeSchema = z.object({
  id: z.string(),
  employeeCode: z.string().min(1, 'Employee code is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().nullable().optional(),
  email: z.email('Invalid email address').nullable().optional(),
  contactNumber: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  status: EmployeeStatusSchema,
  department: DepartmentSchema.nullable().optional(),
  position: PositionSchema.nullable().optional(),
  branch: BranchSchema.nullable().optional(),

  // Personal info
  bloodType: z.string().nullable().optional(),
  maritalStatus: MaritalStatusSchema.nullable().optional(),
  pwdType: z.string().nullable().optional(),

  // Payroll info
  salary: z.number().nullable().optional(),
  allowance: z.number().nullable().optional(),
  allowancePayoutCycle: PayoutCycleSchema.nullable().optional(),
  loan: z.number().nullable().optional(),
  loanDeduction: z.number().nullable().optional(),
  silc: z.number().nullable().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  // Optional fields for future use
  avatar: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
})

export const FilterStateSchema = z.object({
  status: z.string(),
  department: z.string(),
  branch: z.string(),
})

export const MetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  lastPage: z.number().int().nonnegative(),
})

export const EmployeeQueryParamsSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const EmployeeListResponseSchema = z.object({
  data: z.array(EmployeeSchema),
  meta: MetaSchema,
})

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.boolean().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })

export const EmployeeFormDataSchema = EmployeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
})

// TypeScript types inferred from Zod schemas
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>
export type MaritalStatus = z.infer<typeof MaritalStatusSchema>
export type PayoutCycle = z.infer<typeof PayoutCycleSchema>
export type Department = z.infer<typeof DepartmentSchema>
export type Position = z.infer<typeof PositionSchema>
export type Branch = z.infer<typeof BranchSchema>
export type Employee = z.infer<typeof EmployeeSchema>
export type FilterState = z.infer<typeof FilterStateSchema>
export type Meta = z.infer<typeof MetaSchema>
export type EmployeeQueryParams = z.infer<typeof EmployeeQueryParamsSchema>
export type EmployeeListResponse = z.infer<typeof EmployeeListResponseSchema>
export type EmployeeFormData = z.infer<typeof EmployeeFormDataSchema>
export type ApiResponse<T> = {
  data?: T
  success?: boolean
  message?: string
  error?: string
}
