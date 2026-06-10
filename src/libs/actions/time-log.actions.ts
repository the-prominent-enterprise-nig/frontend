'use server'

import { api } from '@/src/libs/api/client'

export type TimeLogSegment = {
  id: string
  timeLogId: string
  type: 'work' | 'pause'
  startedAt: string
  endedAt: string | null
  createdAt: string
}

export type TimeLogEmployee = {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
}

export type TimeLog = {
  id: string
  enterpriseOwnerId: string | null
  employeeId: string
  employee?: TimeLogEmployee
  date: string
  startedAt: string
  stoppedAt: string | null
  status: 'running' | 'paused' | 'completed' | 'missing_stop'
  totalWorkedMinutes: number
  totalPausedMinutes: number
  currentPauseStartedAt: string | null
  note: string | null
  source: 'app' | 'manual' | 'imported'
  createdAt: string
  updatedAt: string
  segments: TimeLogSegment[]
}

export async function getActiveTimer(): Promise<TimeLog | null> {
  const res = await api.get<TimeLog | null>('/attendance/my-time-log/active')
  return res.data ?? null
}

export async function getMyTimeLogs(): Promise<TimeLog[]> {
  const res = await api.get<TimeLog[]>('/attendance/my-time-logs')
  return res.data ?? []
}

export async function startTimer(): Promise<{ success: boolean; data?: TimeLog; error?: string }> {
  const res = await api.post<TimeLog>('/attendance/my-time-log/start', {})
  if (!res.success) return { success: false, error: res.error ?? 'Failed to start timer' }
  return { success: true, data: res.data }
}

export async function pauseTimer(): Promise<{ success: boolean; data?: TimeLog; error?: string }> {
  const res = await api.post<TimeLog>('/attendance/my-time-log/pause', {})
  if (!res.success) return { success: false, error: res.error ?? 'Failed to pause timer' }
  return { success: true, data: res.data }
}

export async function resumeTimer(): Promise<{ success: boolean; data?: TimeLog; error?: string }> {
  const res = await api.post<TimeLog>('/attendance/my-time-log/resume', {})
  if (!res.success) return { success: false, error: res.error ?? 'Failed to resume timer' }
  return { success: true, data: res.data }
}

export async function stopTimer(): Promise<{ success: boolean; data?: TimeLog; error?: string }> {
  const res = await api.post<TimeLog>('/attendance/my-time-log/stop', {})
  if (!res.success) return { success: false, error: res.error ?? 'Failed to stop timer' }
  return { success: true, data: res.data }
}

export async function getAllTimeLogs(params?: {
  employeeId?: string
  startDate?: string
  endDate?: string
}): Promise<TimeLog[]> {
  const query = new URLSearchParams()
  if (params?.employeeId) query.set('employeeId', params.employeeId)
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  const qs = query.toString()
  const res = await api.get<TimeLog[]>(`/attendance/time-logs${qs ? `?${qs}` : ''}`)
  return res.data ?? []
}
