import { z } from 'zod'
import { CreateEmployeeSchema } from '@/src/schema/human-resource/employees/create'

export type FormData = z.infer<typeof CreateEmployeeSchema>
export type FieldErrors = Partial<Record<keyof FormData, string>>
export type TabId = 'basic' | 'employment' | 'personal' | 'payroll'

export interface TabDefinition {
  id: TabId
  label: string
  icon: React.ReactNode
}
