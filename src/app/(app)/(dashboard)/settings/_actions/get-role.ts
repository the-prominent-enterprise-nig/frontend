'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { Role, RoleSchema } from '@/src/schema/settings/list'

/**
 * Get a single role by id, permissions included — backs the Manage Role
 * Access page (previously a modal fed by the roles list already in memory;
 * as its own route it needs its own fetch).
 */
export async function getRole(id: string): Promise<ApiResponse<Role>> {
  try {
    const result = await api.get<Role>(`/roles/${id}`, undefined, {
      tags: ['roles', `role-${id}`],
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch role',
        message: result.message,
      }
    }

    const validated = RoleSchema.parse(result.data)

    return { success: true, data: validated }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch role',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
