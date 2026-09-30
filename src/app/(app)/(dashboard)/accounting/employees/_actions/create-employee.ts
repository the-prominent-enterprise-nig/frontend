'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { EmployeeFormSchema, type Employee } from '@/src/schema/accounting/employees'

export async function createEmployee(input: unknown): Promise<ApiResponse<Employee>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to add an employee',
    }
  }

  const parsed = EmployeeFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { email, ...rest } = parsed.data
  const result = await api.post<Employee>('/accounting/employees', {
    ...rest,
    email: email || undefined,
  })
  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to add the employee',
      message: msg || errStr || 'Failed to add the employee',
    }
  }

  revalidatePath('/accounting/employees')

  return { success: true, data: result.data, message: 'Employee added' }
}
