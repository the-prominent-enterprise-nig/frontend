'use server'

import { api } from '@/src/libs/api/client'
import type { CreditApplication } from '@/src/schema/credit/applications'

export async function getCreditApplication(id: string) {
  return api.get<CreditApplication>(`/credit/applications/${id}`)
}
