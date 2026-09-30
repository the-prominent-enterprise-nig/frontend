'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import {
  PayEmployeeCashLoanFormSchema,
  type EmployeeCashLoan,
} from '@/src/schema/accounting/employee-cash-loans'

export async function payEmployeeCashLoan(
  id: string,
  input: unknown
): Promise<ApiResponse<EmployeeCashLoan>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CASH_LOAN_PAY)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to record a payment on an employee cash loan',
    }
  }

  const parsed = PayEmployeeCashLoanFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<EmployeeCashLoan>(
    `/accounting/employee-cash-loans/${id}/pay`,
    parsed.data
  )
  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to record the payment',
      message: msg || errStr || 'Failed to record the payment',
    }
  }

  revalidatePath('/accounting/employee-cash-loans')
  revalidatePath(`/accounting/employee-cash-loans/${id}`)

  return { success: true, data: result.data, message: 'Payment recorded' }
}
