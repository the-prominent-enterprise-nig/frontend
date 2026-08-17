'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface CalendarEventRecord {
  id: string
  title: string
  date: string // YYYY-MM-DD
  allDay: boolean
  startTime?: string
  endTime?: string
  createdAt: string
}

export interface CreateCalendarEventInput {
  title: string
  date: string // YYYY-MM-DD
  allDay?: boolean
  startTime?: string
  endTime?: string
}

export async function getCalendarEvents(
  year: number,
  month: number
): Promise<ApiResponse<CalendarEventRecord[]>> {
  try {
    const result = await api.get<CalendarEventRecord[]>('/calendar-events', { year, month })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch calendar events' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch calendar events' }
  }
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput
): Promise<ApiResponse<CalendarEventRecord>> {
  try {
    const result = await api.post<CalendarEventRecord>('/calendar-events', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create calendar event' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create calendar event' }
  }
}
