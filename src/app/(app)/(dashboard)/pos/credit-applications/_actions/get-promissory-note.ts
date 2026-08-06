'use server'

import { api } from '@/src/libs/api/client'
import type { PromissoryNote } from '@/src/schema/credit/applications'

export async function getPromissoryNote(applicationId: string) {
  return api.get<PromissoryNote>(`/credit/applications/${applicationId}/promissory-note`)
}
