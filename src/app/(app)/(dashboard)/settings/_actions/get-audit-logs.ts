'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  AuditLogListResponse,
  AuditLogListResponseSchema,
  AuditLogQueryParams,
} from '@/src/schema/settings/audit-logs'

export async function getAuditLogs(
  params?: AuditLogQueryParams
): Promise<ApiResponse<AuditLogListResponse>> {
  try {
    const result = await api.get<AuditLogListResponse>('/audit-logs', params, {
      tags: ['audit-logs'],
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch audit logs',
        message: result.message,
      }
    }

    const validated = AuditLogListResponseSchema.parse(result.data)

    return { success: true, data: validated }
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return {
      success: false,
      error: 'Failed to fetch audit logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
