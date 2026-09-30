'use server'

import { api } from '@/src/libs/api/client'
import type { Employee } from '@/src/schema/accounting/employees'

export async function getEmployee(id: string) {
  return api.get<Employee>(`/accounting/employees/${id}`)
}
