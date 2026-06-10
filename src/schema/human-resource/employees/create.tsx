import { z } from 'zod'

export const EmployeeStatusSchema = z.enum(['active', 'inactive', 'resigned', 'terminated'])
export const MaritalStatusSchema = z.enum(['Single', 'Married', 'Widowed', 'Separated'])
export const PayoutCycleSchema = z.enum(['FirstCycle', 'SecondCycle'])

export const CreateEmployeeSchema = z.object({
  // Basic
  employeeCode: z.string().min(1, 'Employee code is required').max(30),
  firstName: z.string().min(1, 'First name is required').max(60),
  lastName: z.string().min(1, 'Last name is required').max(60),
  middleName: z.string().max(60).optional(),
  email: z
    .string()
    .min(1, 'Email is required')
    .max(60)
    .email('Please provide a valid email address'),
  contactNumber: z
    .string()
    .min(1, 'Contact number is required')
    .regex(/^(\+639|09)\d{9}$/, 'Contact number must be a valid number.'),
  hireDate: z.string().optional(),
  status: EmployeeStatusSchema.optional(),

  // Personal
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  bloodType: z.string().max(10).optional(),
  maritalStatus: MaritalStatusSchema.optional(),
  pwdType: z.string().max(60).optional(),

  // Payroll
  allowance: z.number().min(0, 'Allowance must be at least 0').optional(),
  allowancePayoutCycle: PayoutCycleSchema.optional(),
  loan: z.number().min(0, 'Loan must be at least 0').optional(),
  loanDeduction: z.number().min(0, 'Loan deduction must be at least 0').optional(),
  silc: z.number().min(0, 'SILC must be at least 0').optional(),

  // Org relations
  departmentId: z.uuid('Department ID must be a valid UUID').optional(),
  positionId: z.uuid('Position ID must be a valid UUID').optional(),
  branchId: z.uuid('Branch ID must be a valid UUID').optional(),

  // System access (optional — grants a user account with these roles)
  roleIds: z.array(z.string().uuid()).optional(),
})
