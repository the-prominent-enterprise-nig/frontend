import z from 'zod'
import { EmployeeStatusSchema, MaritalStatusSchema, PayoutCycleSchema } from './types'

export const UpdateEmployeeSchema = z.object({
  // Basic - Required fields remain required
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
  dateOfBirth: z.string().min(1, 'Date of birth is required'),

  // Personal - All optional
  bloodType: z.string().max(10).optional(),
  maritalStatus: MaritalStatusSchema.optional(),
  pwdType: z.string().max(60).optional(),

  // Payroll - All optional
  allowance: z.number().min(0, 'Allowance must be at least 0').optional(),
  allowancePayoutCycle: PayoutCycleSchema.optional(),
  loan: z.number().min(0, 'Loan must be at least 0').optional(),
  loanDeduction: z.number().min(0, 'Loan deduction must be at least 0').optional(),
  silc: z.number().min(0, 'SILC must be at least 0').optional(),

  // Org relations - All optional
  departmentId: z.uuid('Department ID must be a valid UUID').optional(),
  positionId: z.uuid('Position ID must be a valid UUID').optional(),
  branchId: z.uuid('Branch ID must be a valid UUID').optional(),
})
