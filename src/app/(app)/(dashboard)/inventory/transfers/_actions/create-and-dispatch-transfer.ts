'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateTransferFormSchema } from '@/src/schema/inventory/transfers'

type Dispatched = { id: string; transferNumber?: string }

function blankToUndefined(value: string | undefined): string | undefined {
  return value?.trim() || undefined
}

/**
 * General Stockbook's Stock Transfer: the ticked units are created as a
 * transfer and dispatched in one call — no request or approval steps.
 */
export async function createAndDispatchTransfer(input: unknown): Promise<ApiResponse<Dispatched>> {
  const parsed = CreateTransferFormSchema.safeParse(input)
  if (!parsed.success || !parsed.data.delivery) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.success
        ? 'Delivery details are required'
        : parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  // destinationType/newCaravan are form-only (see create-transfer.ts).
  const { delivery, ...data } = parsed.data
  delete data.destinationType
  delete data.newCaravan
  const result = await api.post<Dispatched>('/inventory/transfers/dispatch-now', {
    ...data,
    skipDestinationApproval: undefined,
    expectedArrival: data.expectedArrival || undefined,
    dispatch: {
      expectedArrival: data.expectedArrival || undefined,
      vehiclePlate: delivery.vehiclePlate.trim(),
      driverName: blankToUndefined(delivery.driverName),
      driverPhone: blankToUndefined(delivery.driverPhone),
      carrierName: blankToUndefined(delivery.carrierName),
      notes: blankToUndefined(delivery.notes),
    },
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to dispatch transfer',
      message: msg || errStr || 'Failed to dispatch transfer',
    }
  }

  revalidatePath('/inventory/transfers')

  return {
    success: true,
    data: result.data,
    message: `${result.data?.transferNumber ?? 'Transfer'} is on its way — In Transit.`,
  }
}
