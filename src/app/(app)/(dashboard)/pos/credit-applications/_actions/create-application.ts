'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { CreateCreditApplicationFormSchema } from '@/src/schema/credit/applications'
import type { CreditApplication } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function createCreditApplication(
  input: unknown
): Promise<ApiResponse<CreditApplication>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to submit a credit application',
    }
  }

  const parsed = CreateCreditApplicationFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const payload = {
    ...parsed.data,
    // Backend trusts this client-supplied price over its own Price List
    // resolution — see credit/applications schema's items.estimatedPrice comment.
    // Scenario 60 item 21 (client, 2026-09-28): the price must come from the
    // Inventory price list for the chosen Price Use, "and only that".
    // unitPrice is deliberately NOT sent. It used to carry the form's
    // estimatedPrice, which is seeded from the flat Item.sellingPrice — and
    // a client-supplied unitPrice makes the server skip price-list
    // resolution entirely, so the application was priced off the wrong
    // number AND lost its priceListItemId, which is what the curated down
    // payment and the rate-card instalment figures hang off. estimatedPrice
    // stays in the form for the on-screen financing preview only.
    items: parsed.data.items.map(({ itemId }) => ({ itemId })),
  }

  const result = await api.post<CreditApplication>('/credit/applications', payload)
  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create credit application',
      message: msg || errStr || 'Failed to create credit application',
    }
  }

  revalidatePath('/pos/credit-applications')

  return { success: true, data: result.data, message: 'Credit application saved as draft' }
}
