import { z } from 'zod'

export type EmployeeStatus = 'active' | 'inactive' | 'resigned' | 'terminated'
export type EmployeeMaritalStatus = 'Single' | 'Married' | 'Widowed' | 'Separated'

export const EMPLOYEE_STATUS_OPTIONS: EmployeeStatus[] = [
  'active',
  'inactive',
  'resigned',
  'terminated',
]
export const EMPLOYEE_MARITAL_STATUS_OPTIONS: EmployeeMaritalStatus[] = [
  'Single',
  'Married',
  'Widowed',
  'Separated',
]

export type EmployeeBranch = { id: string; name: string }
export type EmployeeManager = {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
}

export type Employee = {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  middleName?: string | null
  email?: string | null
  contactNumber?: string | null
  dateOfBirth?: string | null
  hireDate?: string | null
  status: EmployeeStatus
  maritalStatus: EmployeeMaritalStatus
  pwdType?: string | null
  isStudent: boolean
  branchId?: string | null
  branch?: EmployeeBranch | null
  managerId?: string | null
  manager?: EmployeeManager | null
  // POS buyer flow — set once this employee has bought something at POS at
  // least once (get-or-created, see PosCustomersService.getOrCreateFromEmployee).
  customer?: { id: string; name: string; customerCode: string } | null
  createdAt: string
  updatedAt: string
}

export type EmployeeListResponse = {
  items: Employee[]
  total: number
  page: number
  limit: number
}

// employeeCode is optional here too — editable, but never required on its
// own; the backend auto-generates one on create when left blank.
export const EmployeeFormSchema = z.object({
  employeeCode: z.string().max(30).optional(),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  middleName: z.string().max(100).optional(),
  email: z.string().email('Enter a valid email').max(150).optional().or(z.literal('')),
  contactNumber: z.string().max(30).optional(),
  dateOfBirth: z.string().optional(),
  hireDate: z.string().optional(),
  status: z.enum(['active', 'inactive', 'resigned', 'terminated']).optional(),
  maritalStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated']).optional(),
  pwdType: z.string().max(100).optional(),
  isStudent: z.boolean().optional(),
  branchId: z.string().optional(),
  managerId: z.string().optional(),
})

export type EmployeeFormValues = z.infer<typeof EmployeeFormSchema>
