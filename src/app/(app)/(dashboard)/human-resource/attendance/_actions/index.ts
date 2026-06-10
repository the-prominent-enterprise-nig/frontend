'use server'

import { api } from '@/src/libs/api/client'
import { getSession } from '@/src/libs/auth/actions/get-session'

export type AttendanceEmployee = {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
}

export type AttendanceStatusType = {
  id: string
  statusName: string
  statusCode: string
  description?: string | null
  statusCategory?: string | null
  payrollImpact?: string | null
  deductionType?: string | null
  deductionValue?: number | null
  isActive: boolean
  enterpriseOwnerId?: string | null
}

export type AttendanceLog = {
  id: string
  employeeId: string
  date: string
  startTime?: string | null
  endTime?: string | null
  totalHours?: number | null
  statusTypeId?: string | null
  employee: AttendanceEmployee
  statusType?: AttendanceStatusType | null
}

export type ShiftSchedule = {
  id: string
  employeeId: string
  shiftName: string
  expectedStart: string
  expectedEnd: string
  restDay?: string | null
  effectiveDate: string
  isActive: boolean
  employee: AttendanceEmployee
}

export type OvertimeRequest = {
  id: string
  employeeId: string
  date: string
  startTime: string
  endTime: string
  totalHours: number
  reason?: string | null
  status: string
  reviewedBy?: string | null
  employee: AttendanceEmployee
}

export type CorrectionRequest = {
  id: string
  employeeId: string
  date: string
  requestedStart?: string | null
  requestedEnd?: string | null
  reason?: string | null
  status: string
  employee: AttendanceEmployee
  attendanceLog?: { id: string; clockIn?: string | null; clockOut?: string | null } | null
}

export type AdjustmentRecord = {
  id: string
  employeeId: string
  adjustmentType: string
  adjustedValue: string
  reason?: string | null
  adjustmentDate: string
  requestedBy?: string | null
  approvedBy?: string | null
  referenceDocument?: string | null
  remarks?: string | null
  employee: AttendanceEmployee
}

export type AttendanceSummary = {
  id: string
  employeeId: string
  cutoffStart: string
  cutoffEnd: string
  totalTrackedHours: number
  totalDaysWorked: number
  totalAbsences: number
  totalTardiness: number
  totalOvertimeHours: number
  leaveDaysRecorded: number
  status: string
  employee: AttendanceEmployee
}

export async function getAttendanceLogs(): Promise<AttendanceLog[]> {
  const res = await api.get<AttendanceLog[]>('/attendance/logs')
  return res.data ?? []
}

export async function getShiftSchedules(): Promise<ShiftSchedule[]> {
  const res = await api.get<ShiftSchedule[]>('/attendance/shift-schedules')
  return res.data ?? []
}

export async function getOvertimeRequests(): Promise<OvertimeRequest[]> {
  const res = await api.get<OvertimeRequest[]>('/attendance/overtime-requests')
  return res.data ?? []
}

export async function getCorrectionRequests(): Promise<CorrectionRequest[]> {
  const res = await api.get<CorrectionRequest[]>('/attendance/correction-requests')
  return res.data ?? []
}

export async function getAttendanceChangeRequests(): Promise<CorrectionRequest[]> {
  return getCorrectionRequests()
}

export async function getAdjustmentRecords(): Promise<AdjustmentRecord[]> {
  const res = await api.get<AdjustmentRecord[]>('/attendance/adjustment-records')
  return res.data ?? []
}

export async function getAttendanceSummary(): Promise<AttendanceSummary[]> {
  const res = await api.get<AttendanceSummary[]>('/attendance/summary')
  return res.data ?? []
}

export type AttendanceStatusTypeInput = {
  statusName: string
  statusCode: string
  description?: string | null
  statusCategory: string
  payrollImpact: string
  deductionType?: string | null
  deductionValue?: number | null
  isActive?: boolean
}

export async function getStatusTypes(options?: {
  includeInactive?: boolean
}): Promise<AttendanceStatusType[]> {
  const query = options?.includeInactive ? '?includeInactive=true' : ''
  const res = await api.get<AttendanceStatusType[]>(`/attendance/status-types${query}`)
  return res.data ?? []
}

export async function createStatusType(
  data: AttendanceStatusTypeInput
): Promise<{ success: boolean; error?: string }> {
  const res = await api.post('/attendance/status-types', data)
  if (!res.success) return { success: false, error: res.error ?? 'Failed to create status type' }
  return { success: true }
}

export async function updateStatusType(
  id: string,
  data: AttendanceStatusTypeInput
): Promise<{ success: boolean; error?: string }> {
  const res = await api.patch(`/attendance/status-types/${id}`, data)
  if (!res.success) return { success: false, error: res.error ?? 'Failed to update status type' }
  return { success: true }
}

export async function setStatusTypeActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const endpoint = isActive ? 'activate' : 'deactivate'
  const res = await api.patch(`/attendance/status-types/${id}/${endpoint}`, {})
  if (!res.success)
    return {
      success: false,
      error: res.error ?? `Failed to ${isActive ? 'activate' : 'deactivate'} status type`,
    }
  return { success: true }
}

export type TimeLogEntry = {
  id: string
  employeeId: string
  date: string
  startedAt: string
  stoppedAt: string | null
  status: 'running' | 'paused' | 'completed' | 'missing_stop'
  totalWorkedMinutes: number
  totalPausedMinutes: number
  source: string
  employee: AttendanceEmployee
}

export async function getTimeLogs(params?: {
  employeeId?: string
  startDate?: string
  endDate?: string
}): Promise<TimeLogEntry[]> {
  const query = new URLSearchParams()
  if (params?.employeeId) query.set('employeeId', params.employeeId)
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  const qs = query.toString()
  const res = await api.get<TimeLogEntry[]>(`/attendance/time-logs${qs ? `?${qs}` : ''}`)
  return res.data ?? []
}

export async function getAttendanceSettings(): Promise<{ cutoffTime: string }> {
  const res = await api.get<{ cutoffTime: string }>('/attendance/settings')
  return res.data ?? { cutoffTime: '10:00' }
}

export async function updateAttendanceCutoff(
  cutoffTime: string
): Promise<{ success: boolean; error?: string }> {
  const res = await api.patch('/attendance/settings', { cutoffTime })
  if (!res.success) return { success: false, error: res.error ?? 'Failed to update cutoff time' }
  return { success: true }
}

export async function processAttendance(
  date: string,
  cutoffTime: string
): Promise<{
  success: boolean
  data?: { processed: number; date: string; cutoffTime: string }
  error?: string
}> {
  const res = await api.post<{ processed: number; date: string; cutoffTime: string }>(
    '/attendance/process',
    { date, cutoffTime }
  )
  if (!res.success) return { success: false, error: res.error ?? 'Failed to process attendance' }
  return { success: true, data: res.data }
}

export async function updateOvertimeStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED'
): Promise<{ success: boolean; error?: string }> {
  let reviewedBy = 'unknown@prominent.com'
  try {
    const session = await getSession()
    reviewedBy = session?.email ?? reviewedBy
  } catch {
    /* noop */
  }

  const res = await api.post(`/attendance/overtime-requests/${id}/status`, { status, reviewedBy })
  if (!res.success)
    return { success: false, error: res.error ?? 'Failed to update overtime status' }
  return { success: true }
}
