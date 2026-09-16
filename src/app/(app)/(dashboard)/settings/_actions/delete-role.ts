'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { can } from '@/src/libs/guards/permission'

/**
 * Soft-delete a role — DELETE /roles/:id sets isActive: false server-side
 * (roles.service.ts), never a hard delete. Blocked there for the six fixed
 * system roles (Business Owner, Branch Manager, Accountant, Stock
 * Controller, Cashier, Marketing Manager) with a 403; the UI already keeps
 * the Delete menu item off those rows (PROTECTED_ROLE_NAMES in
 * RolesSection.tsx) so this should never actually hit that block in
 * practice, but the backend enforces it regardless.
 *
 * See reactivate-role.ts for the inverse — POST /roles/:id/reactivate sets
 * isActive back to true, restoring exactly what was here since remove()
 * never touches permissions or user assignments, only this one flag.
 */
export async function deleteRole(id: string): Promise<ApiResponse> {
  try {
    const session = await getSession()
    if (!session) {
      return {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to delete roles',
      }
    }

    if (!can(session, 'admin:roles:delete') && !can(session, 'admin:roles:manage')) {
      return {
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to delete roles. Required: admin:roles:delete',
      }
    }

    const response = await api.delete(`/roles/${id}`)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to delete role',
        message: response.message,
      }
    }

    revalidatePath('/settings/roles')

    return { success: true, message: 'Role deleted' }
  } catch (error) {
    console.error('Error deleting role:', error)
    return {
      success: false,
      error: 'Failed to delete role',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
