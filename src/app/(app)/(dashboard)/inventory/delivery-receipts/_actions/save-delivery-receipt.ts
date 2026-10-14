'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import {
  DrFormSchema,
  isRepairPurpose,
  occasionOf,
  type DrFormValues,
} from '@/src/schema/inventory/delivery-receipts'
import { drFailure } from '../_lib/dr-errors'

const blank = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim())

/** Form values → the backend DTO. Empty strings are not sent (the API
 * validates ids as UUIDs and dates as ISO strings). */
function toBody(v: DrFormValues): Record<string, unknown> {
  // A repair DR's lines come from its UDS, server-side; sending none keeps
  // the browser from ever being the source of what leaves.
  const repair = isRepairPurpose(v.purpose)
  return {
    purpose: v.purpose,
    purposeDetail: v.purpose === 'raffle_prize' ? blank(occasionOf(v)) : undefined,
    issueDate: v.issueDate,
    warehouseId: v.warehouseId,
    departmentId: blank(v.departmentId),
    udsId: repair ? blank(v.udsId) : undefined,
    customerId: blank(v.customerId),
    supplierId: blank(v.supplierId),
    deliveredTo: blank(v.deliveredTo),
    customerCode: blank(v.customerCode),
    address: blank(v.address),
    contactNo: blank(v.contactNo),
    referenceNo: blank(v.referenceNo),
    referenceDate: blank(v.referenceDate),
    reason: blank(v.reason),
    remarks: blank(v.remarks),
    lines: repair
      ? undefined
      : v.lines.map((l) => ({
          itemId: l.itemId,
          serialNumberId: blank(l.serialNumberId),
          quantity: l.isSerialTracked ? 1 : l.quantity,
        })),
  }
}

/** Creates the draft when there is no id yet (which takes its DR number),
 * otherwise saves over it. */
export async function saveDeliveryReceipt(
  id: string | null,
  input: unknown
): Promise<ApiResponse<{ id: string; drNumber: string }>> {
  const session = await getSessionOrNull()
  const permission = id
    ? INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_UPDATE
    : INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE
  if (!session || !can(session, permission)) {
    return { success: false, error: 'Forbidden', message: 'You cannot save delivery receipts' }
  }
  const parsed = DrFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed', message: parsed.error.issues[0]?.message }
  }
  const body = toBody(parsed.data)
  const result = id
    ? await api.patch<{ id: string; drNumber: string }>(`/inventory/delivery-receipts/${id}`, body)
    : await api.post<{ id: string; drNumber: string }>('/inventory/delivery-receipts', body)
  if (!result.success || !result.data) return drFailure(result, 'Failed to save the draft')
  revalidatePath('/inventory/stock-transaction')
  return { success: true, data: result.data, message: `Draft ${result.data.drNumber} saved` }
}
