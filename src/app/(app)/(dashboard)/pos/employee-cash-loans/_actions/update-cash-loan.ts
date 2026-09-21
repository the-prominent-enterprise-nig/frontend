'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import {
  UpdateEmployeeCashLoanFormSchema,
  type EmployeeCashLoan,
} from '@/src/schema/pos/employee-cash-loans'

export async function updateEmployeeCashLoan(
  id: string,
  input: unknown
): Promise<ApiResponse<EmployeeCashLoan>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, POS_PERMISSIONS.EMPLOYEE_CASH_LOAN_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to edit an employee cash loan',
    }
  }

  const parsed = UpdateEmployeeCashLoanFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<EmployeeCashLoan>(`/pos/employee-cash-loans/${id}`, parsed.data)
  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update the cash loan',
      message: msg || errStr || 'Failed to update the cash loan',
    }
  }

  revalidatePath('/pos/employee-cash-loans')
  revalidatePath(`/pos/employee-cash-loans/${id}`)

  return { success: true, data: result.data, message: 'Cash loan updated' }
}
