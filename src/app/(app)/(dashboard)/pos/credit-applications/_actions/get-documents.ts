'use server'

import { api } from '@/src/libs/api/client'
import type { CreditApplicationDocument } from '@/src/schema/credit/applications'

export async function getCreditApplicationDocuments(applicationId: string) {
  return api.get<CreditApplicationDocument[]>(`/credit/applications/${applicationId}/documents`)
}
