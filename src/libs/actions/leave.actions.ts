'use server'

import {
  leaveApprovalSchema,
  leaveAdjustmentSchema,
  submitLeaveRequestSchema,
  myLeaveRequestSchema,
} from '@/src/schema/human-resource/leave/leave.schema'
import { api } from '@/src/libs/api/client'
import { getSession } from '@/src/libs/auth/actions/get-session'

// ─── Types ────────────────────────────────────────────────

type LeaveRequestFilters = {
  employeeId?: string
  status?: string
  leaveTypeId?: string
  search?: string
  month?: string // YYYY-MM
}

type ArchivedRequestFilters = {
  employeeId?: string
  status?: string
  search?: string
  before?: string // YYYY-MM upper bound, defaults to current month
  page?: number
  limit?: number
}

// ─── Current user helper ─────────────────────────────────────────────────────

/** Returns the current session or a safe fallback. Never throws. */
async function getCurrentUser() {
  try {
    return await getSession()
  } catch {
    return null
  }
}

/** Returns the current user's email for audit fields (reviewedBy / updatedBy). */
async function getCurrentUserEmail(): Promise<string> {
  const session = await getCurrentUser()
  return session?.email ?? 'unknown@prominent.com'
}

/** Returns the current user's employeeId for personal endpoints. */
async function getCurrentEmployeeId(): Promise<string | null> {
  const session = await getCurrentUser()
  return session?.employeeId ?? null
}

// ─── Session export ───────────────────────────────────────────────────────────

/** Returns the current user's session profile for use in client components. */
export async function getMySession() {
  const session = await getCurrentUser()
  if (!session) return { success: false as const, error: 'Not authenticated' }
  return {
    success: true as const,
    data: {
      id: session.id,
      name: session.name ?? null,
      email: session.email ?? null,
      employeeId: session.employeeId ?? null,
    },
  }
}

// ─── Leave Type Actions ───────────────────────────────────────────────────────

export async function getLeaveTypes() {
  const result = await api.get('/leave-management/types', { isActive: true, limit: 100 })
  if (!result.success) return { success: false as const, error: result.error }
  const paginated = result.data as { data: unknown[] } | undefined
  return { success: true as const, data: paginated?.data ?? [] }
}

// ─── Leave Request Actions ────────────────────────────────────────────────────

export async function getLeaveRequests(filters?: LeaveRequestFilters) {
  const params: Record<string, string> = {}
  if (filters?.employeeId) params.employeeId = filters.employeeId
  if (filters?.status) params.status = filters.status
  if (filters?.leaveTypeId) params.leaveTypeId = filters.leaveTypeId
  if (filters?.search) params.search = filters.search
  if (filters?.month) params.month = filters.month

  const result = await api.get('/leave-management/requests', params)
  if (!result.success) return { success: false as const, error: result.error }
  const paginated = result.data as { data: unknown[] } | undefined
  return { success: true as const, data: paginated?.data ?? [] }
}

export async function getArchivedRequests(filters?: ArchivedRequestFilters) {
  const params: Record<string, string | number> = {}
  if (filters?.employeeId) params.employeeId = filters.employeeId
  if (filters?.status) params.status = filters.status
  if (filters?.search) params.search = filters.search
  if (filters?.before) params.before = filters.before
  if (filters?.page) params.page = filters.page
  if (filters?.limit) params.limit = filters.limit

  const result = await api.get('/leave-management/requests/archived', params)
  if (!result.success) return { success: false as const, error: result.error }
  const paginated = result.data as { data: unknown[] } | undefined
  return { success: true as const, data: paginated?.data ?? [] }
}

export async function createLeaveRequest(input: unknown) {
  const result = submitLeaveRequestSchema.safeParse(input)
  if (!result.success) {
    return { success: false as const, error: 'Validation failed', details: result.error.flatten() }
  }

  const { startDate, endDate, ...rest } = result.data
  const body = {
    ...rest,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }

  const apiResult = await api.post('/leave-management/requests', body)
  if (!apiResult.success) return { success: false as const, error: apiResult.error }
  return { success: true as const, data: apiResult.data }
}

export async function approveLeaveRequest(input: unknown) {
  const result = leaveApprovalSchema.safeParse(input)
  if (!result.success) {
    return { success: false as const, error: 'Validation failed', details: result.error.flatten() }
  }

  const reviewedBy = await getCurrentUserEmail()
  const { leaveRequestId, decision, remarks } = result.data
  const endpoint =
    decision === 'Approved'
      ? `/leave-management/requests/${leaveRequestId}/approve`
      : `/leave-management/requests/${leaveRequestId}/reject`

  const apiResult = await api.patch(endpoint, { reviewedBy, remarks: remarks ?? undefined })
  if (!apiResult.success) return { success: false as const, error: apiResult.error }
  return { success: true as const, data: apiResult.data }
}

// ─── Monthly Summary Action ───────────────────────────────────────────────────

export async function getMonthlySummary(month?: string) {
  const params: Record<string, string> = {}
  if (month) params.month = month

  const result = await api.get('/leave-management/summary', params)
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

// ─── Personal Leave Balance Actions ──────────────────────────────────────────

/**
 * Returns the leave balance for the given employee (or the current logged-in
 * employee when employeeId is omitted).
 */
export async function getLeaveBalance(
  employeeId?: string,
  year: number = new Date().getFullYear()
) {
  const resolvedId = employeeId ?? (await getCurrentEmployeeId())
  if (!resolvedId) return { success: false as const, error: 'No employee linked to current user' }

  const result = await api.get('/leave-management/personal/balances', {
    employeeId: resolvedId,
    year,
  })
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

// ─── Personal Leave Request Actions ──────────────────────────────────────────

/**
 * Returns all leave requests for the given employee (or the current logged-in
 * employee when employeeId is omitted).
 */
export async function getPersonalRequests(employeeId?: string) {
  const resolvedId = employeeId ?? (await getCurrentEmployeeId())
  if (!resolvedId) return { success: false as const, error: 'No employee linked to current user' }

  const result = await api.get('/leave-management/personal/requests', { employeeId: resolvedId })
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

// ─── Calculate Days (holiday-aware preview) ───────────────────────────────────

export async function calculateLeaveDays(startDate: string, endDate: string) {
  const result = await api.get('/leave-management/calculate-days', { startDate, endDate })
  if (!result.success) return { success: false as const, error: result.error }
  return {
    success: true as const,
    data: result.data as {
      calendarDays: number
      chargeableLeaveDays: number
      excludedHolidays: { date: string; name: string }[]
    },
  }
}

// ─── My Leave Request (workspace — no employeeId, backend resolves from session) ─

export async function submitMyLeaveRequest(input: unknown) {
  const result = myLeaveRequestSchema.safeParse(input)
  if (!result.success) {
    return { success: false as const, error: 'Validation failed', details: result.error.flatten() }
  }

  const { startDate, endDate, supportingAttachment, ...rest } = result.data
  const body = {
    ...rest,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    ...(supportingAttachment ? { supportingAttachment } : {}),
  }

  const apiResult = await api.post('/leave-management/requests', body)
  if (!apiResult.success) return { success: false as const, error: apiResult.error }
  return { success: true as const, data: apiResult.data }
}

// ─── Leave Adjustment Actions ─────────────────────────────────────────────────

export async function createLeaveAdjustment(input: unknown) {
  const result = leaveAdjustmentSchema.safeParse(input)
  if (!result.success) {
    return { success: false as const, error: 'Validation failed', details: result.error.flatten() }
  }

  // updatedBy is already in the validated data (from the modal form / LOGGED_IN_USER_EMAIL).
  // Override with the real session email when available so the field is always authoritative.
  const updatedBy = await getCurrentUserEmail()

  // Strip effectiveImmediately (frontend-only field) before sending to backend
  const { effectiveImmediately: _ei, ...body } = result.data

  const apiResult = await api.post('/leave-management/adjustments', { ...body, updatedBy })
  if (!apiResult.success) return { success: false as const, error: apiResult.error }
  return { success: true as const, data: apiResult.data }
}
