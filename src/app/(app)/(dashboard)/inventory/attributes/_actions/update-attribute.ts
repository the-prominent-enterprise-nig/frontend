'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { z } from 'zod'
import { AttributeDataTypeEnum } from '@/src/schema/inventory/attributes'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

const UpdateAttributeSchema = z.object({
  displayName: z.string().min(1).optional(),
  dataType: AttributeDataTypeEnum.optional(),
  isRequired: z.boolean().optional(),
  defaultValue: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
  displayOrder: z.number().int().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export type UpdateAttributeValues = z.infer<typeof UpdateAttributeSchema>

export async function updateAttribute(id: string, input: unknown): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ATTRIBUTES_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage attributes',
    }
  }

  const parsed = UpdateAttributeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(`/inventory/attributes/definitions/${id}`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update attribute',
      message: msg || errStr || 'Failed to update attribute',
    }
  }

  revalidatePath('/inventory/catalog')
  return { success: true, data: result.data, message: 'Attribute updated successfully' }
}
