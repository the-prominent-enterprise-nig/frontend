import { z } from 'zod'
import { SUPPLIER_STATUSES } from '../suppliers'

/**
 * A service center is a Supplier flagged `isServiceCenter` — it repairs units
 * for us. The client's records hold only a name and an address, so that is
 * all this form asks for; the supplier code is generated on create, and the
 * accounting fields (VAT, EWT, terms, bank accounts) stay with
 * Accounting → Suppliers.
 */
export const ServiceCenterFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  address: z.string().max(500).optional(),
  status: z.enum(SUPPLIER_STATUSES),
})

export type ServiceCenterFormValues = z.infer<typeof ServiceCenterFormSchema>
