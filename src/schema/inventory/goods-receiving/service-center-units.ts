import { z } from 'zod'

// Scenario 73 — a Repair/Return RR received "From Service Center". A service
// center is the repair ticket's repair provider (a Supplier); these mirror
// backend ServiceCenterUnitsService's responses.

export const ServiceCenterOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  /** Tickets out there now, within what the caller may see. */
  ticketCount: z.number(),
})

export const ServiceCenterUnitSchema = z.object({
  /** `at_provider` — out on a dispatch; `not_dispatched` — on an open ticket
   * that never went out in the system (paper DR); `no_ticket` — a customer's
   * unit with no open ticket (pre-system). */
  kind: z.enum(['at_provider', 'not_dispatched', 'no_ticket']),
  serialNumberId: z.string(),
  serialNumber: z.string(),
  item: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    modelNumber: z.string().nullable(),
    brand: z.string().nullable(),
  }),
  customer: z.object({ id: z.string(), name: z.string() }).nullable(),
  uds: z
    .object({
      id: z.string(),
      code: z.string(),
      dispatchDeliveryReceiptNumber: z.string().nullable(),
      dispatchedAt: z.string().nullable(),
      repairEstimatedCost: z.number().nullable(),
      warehouse: z.object({ id: z.string(), name: z.string() }).nullable(),
    })
    .nullable(),
})

export type ServiceCenterOption = z.infer<typeof ServiceCenterOptionSchema>
export type ServiceCenterUnit = z.infer<typeof ServiceCenterUnitSchema>
