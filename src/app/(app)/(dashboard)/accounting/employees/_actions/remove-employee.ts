'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'

export async function removeEmployee(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_DELETE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to remove this employee',
    }
  }

  const result = await api.delete(`/accounting/employees/${id}`)
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to remove the employee',
      message: (result.message as string) || result.error || 'Failed to remove the employee',
    }
  }

  revalidatePath('/accounting/employees')

  return { success: true, message: 'Employee removed' }
}
