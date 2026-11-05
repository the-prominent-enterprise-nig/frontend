'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { can } from '@/src/libs/guards/permission'
import { isHomeModule } from '@/src/libs/guards/home-module'

/**
 * Change a role's home page (where its people land, and the menu and dashboard
 * they open with). PATCH /roles/:id; null puts it back to automatic.
 */
export async function updateRoleHomeModule(
  id: string,
  homeModule: string | null
): Promise<ApiResponse> {
  try {
    const session = await getSession()
    if (!session) {
      return {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to edit roles',
      }
    }

    if (!can(session, 'admin:roles:update') && !can(session, 'admin:roles:manage')) {
      return {
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to edit roles. Required: admin:roles:update',
      }
    }

    if (homeModule !== null && !isHomeModule(homeModule)) {
      return {
        success: false,
        error: 'Validation failed',
        message: 'Choose one of the listed home pages',
      }
    }

    const response = await api.patch(`/roles/${id}`, { homeModule })

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to update role',
        message: response.message,
      }
    }

    revalidatePath('/settings/roles')
    revalidatePath(`/settings/roles/${id}`)

    return { success: true, message: 'Home page updated' }
  } catch (error) {
    console.error('Error updating role home page:', error)
    return {
      success: false,
      error: 'Failed to update role',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
