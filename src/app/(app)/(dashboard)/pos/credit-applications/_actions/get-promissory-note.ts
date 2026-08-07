'use server'

import { api } from '@/src/libs/api/client'
import type { PromissoryNote } from '@/src/schema/credit/applications'

/** One note per installment line (2026-08-06 per-line financing) — always
 * an array, even for a single-line sale. */
export async function getPromissoryNote(applicationId: string) {
  return api.get<PromissoryNote[]>(`/credit/applications/${applicationId}/promissory-note`)
}
