'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { z } from 'zod'
import {
  Holiday,
  HolidayArraySchema,
  HolidaySchema,
  CreateHolidayInput,
  UpdateHolidayInput,
} from '@/src/schema/human-resource/holidays'
import { revalidateTag } from 'next/cache'

const TAG = 'holidays'

export async function getHolidays(params?: {
  year?: number
  isActive?: 'true' | 'false'
}): Promise<ApiResponse<Holiday[]>> {
  try {
    const result = await api.get<Holiday[]>(
      '/holidays',
      params as Record<string, string | number | boolean | undefined>,
      {
        tags: [TAG],
      }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to fetch holidays' }
    }
    const parsed = HolidayArraySchema.safeParse(result.data)
    if (!parsed.success) {
      console.error('[getHolidays] schema mismatch:', parsed.error.issues)
      return { success: true, data: result.data as Holiday[] }
    }
    return { success: true, data: parsed.data }
  } catch (error) {
    console.error('[getHolidays]', error)
    return { success: false, error: 'Failed to fetch holidays' }
  }
}

export async function createHoliday(input: CreateHolidayInput): Promise<ApiResponse<Holiday>> {
  try {
    const result = await api.post<Holiday>('/holidays', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to create holiday' }
    }
    revalidateTag(TAG, 'max')
    return { success: true, data: HolidaySchema.parse(result.data) }
  } catch (error) {
    console.error('[createHoliday]', error)
    return { success: false, error: 'Failed to create holiday' }
  }
}

export async function updateHoliday(
  id: string,
  input: UpdateHolidayInput
): Promise<ApiResponse<Holiday>> {
  try {
    const result = await api.patch<Holiday>(`/holidays/${id}`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to update holiday' }
    }
    revalidateTag(TAG, 'max')
    return { success: true, data: HolidaySchema.parse(result.data) }
  } catch (error) {
    console.error('[updateHoliday]', error)
    return { success: false, error: 'Failed to update holiday' }
  }
}

export async function deleteHoliday(id: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.delete(`/holidays/${id}`)
    if (!result.success) {
      return { success: false, error: result.error ?? 'Failed to delete holiday' }
    }
    revalidateTag(TAG, 'max')
    return { success: true }
  } catch (error) {
    console.error('[deleteHoliday]', error)
    return { success: false, error: 'Failed to delete holiday' }
  }
}

export async function applyPhilippineTemplate(
  year: number
): Promise<
  ApiResponse<{ year: number; created: number; skipped: number; total: number; warning: string }>
> {
  try {
    const result = await api.post<{
      year: number
      created: number
      skipped: number
      total: number
      warning: string
    }>(`/holidays/apply-template/philippines?year=${year}`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to apply template' }
    }
    revalidateTag(TAG, 'max')
    return { success: true, data: result.data }
  } catch (error) {
    console.error('[applyPhilippineTemplate]', error)
    return { success: false, error: 'Failed to apply template' }
  }
}

const BranchSchema = z.object({ id: z.string(), name: z.string() })
type Branch = z.infer<typeof BranchSchema>

export async function getEnterpriseBranches(): Promise<ApiResponse<Branch[]>> {
  try {
    const result = await api.get<Branch[]>('/enterprise/branches', undefined, {
      tags: ['enterprise-branches'],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to fetch branches' }
    }
    return { success: true, data: z.array(BranchSchema).parse(result.data) }
  } catch (error) {
    console.error('[getEnterpriseBranches]', error)
    return { success: false, error: 'Failed to fetch branches' }
  }
}
