'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { DuplicateCandidateSchema, type DuplicateCandidate } from '@/src/schema/inventory/items'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { z } from 'zod'

export async function checkItemDuplicates(
  name: string,
  brandId?: string
): Promise<ApiResponse<DuplicateCandidate[]>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_CREATE)) {
    // Non-blocking feature — fail quietly rather than surfacing a toast for
    // something the create form's own permission gate already covers.
    return { success: true, data: [] }
  }

  const result = await api.get<DuplicateCandidate[]>('/inventory/items/check-duplicates', {
    name,
    ...(brandId && { brandId }),
  })

  if (!result.success || !result.data) {
    return { success: true, data: [] }
  }

  const validated = z.array(DuplicateCandidateSchema).safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : [] }
}
