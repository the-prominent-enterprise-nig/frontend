'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import {
  SaveDailyCollectionSheetSchema,
  type DailyCollectionSheet,
} from '@/src/schema/pos/daily-collection'

/**
 * Scenario 53 Part 6 — saves the handwritten half of the Daily Collection
 * Report: signatories, remarks, and a corrected denomination count.
 *
 * Page-local plain server action with its own session and permission check,
 * `safeParse`, `api.put()` — the POS convention, not the
 * next-safe-action/authAction pattern.
 */
export async function saveDailyCollectionSheet(
  input: unknown
): Promise<ApiResponse<DailyCollectionSheet>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, POS_PERMISSIONS.DAILY_COLLECTION_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to edit this report',
    }
  }

  const parsed = SaveDailyCollectionSheetSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.put<DailyCollectionSheet>(
    '/pos/reports/daily-collection/sheet',
    parsed.data
  )
  if (!result.success) return result

  revalidatePath('/pos/daily-collection')
  return { ...result, message: 'Form saved.' }
}
