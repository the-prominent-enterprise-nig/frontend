import { z } from 'zod'

// ─── Refs ────────────────────────────────────────────────────────────────────

export const DepartmentRefSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const PositionRefSchema = z.object({
  id: z.string(),
  title: z.string(),
})

export const BranchRefSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// ─── Nested ──────────────────────────────────────────────────────────────────

export const GovernmentIDSchema = z.object({
  id: z.string(),
  type: z.string(), // 'SSS' | 'PhilHealth' | 'Pag-IBIG' | 'TIN' | 'UMID'
  number: z.string(),
  isActive: z.boolean(),
})

export const BankAccountSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  accountNumber: z.string(),
  accountName: z.string(),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
})

export const EmergencyContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string(),
  contactNumber: z.string(),
  isPrimary: z.boolean(),
})

// ─── Employee status ─────────────────────────────────────────────────────────

export const EmployeeStatusSchema = z.enum(['active', 'inactive', 'resigned', 'terminated'])

export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>

// ─── Main DTO ────────────────────────────────────────────────────────────────

export const EmployeeDetailSchema = z.object({
  id: z.string(),
  employeeCode: z.string(),

  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional().nullable(),

  email: z.string().email().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),

  status: EmployeeStatusSchema,

  department: DepartmentRefSchema.optional().nullable(),
  position: PositionRefSchema.optional().nullable(),
  branch: BranchRefSchema.optional().nullable(),

  bloodType: z.string().optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
  pwdType: z.string().optional().nullable(),
  isStudent: z.boolean().optional().nullable(),

  salary: z.number().optional().nullable(),
  allowance: z.number().optional().nullable(),
  allowancePayoutCycle: z.string().optional().nullable(), // 'FirstCycle' | 'SecondCycle' | 'Both'
  loan: z.number().optional().nullable(),
  loanDeduction: z.number().optional().nullable(),
  silc: z.number().optional().nullable(),

  governmentIDs: z.array(GovernmentIDSchema).optional().nullable(),
  bankAccounts: z.array(BankAccountSchema).optional().nullable(),
  emergencyContacts: z.array(EmergencyContactSchema).optional().nullable(),

  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional().nullable(),
})

// ─── Types ───────────────────────────────────────────────────────────────────

export type EmployeeDetailDto = z.infer<typeof EmployeeDetailSchema>
export type GovernmentID = z.infer<typeof GovernmentIDSchema>
export type BankAccount = z.infer<typeof BankAccountSchema>
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>
export type DepartmentRef = z.infer<typeof DepartmentRefSchema>
export type PositionRef = z.infer<typeof PositionRefSchema>
export type BranchRef = z.infer<typeof BranchRefSchema>
