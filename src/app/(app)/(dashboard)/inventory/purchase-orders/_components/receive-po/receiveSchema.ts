import { z } from 'zod'

const ReceivePoLineSchema = z
  .object({
    purchaseOrderLineId: z.string(),
    itemId: z.string(),
    quantityReceived: z.number().min(0),
    unitCost: z.number().min(0).optional(),
    // Scenario 46 — the supplier's pricing as stated, carried through from the
    // PO line. Receiving used to keep only the resulting unitCost, so the DR
    // could not show WHY a cost was what it was and an AP bill had nothing to
    // match its own discounts against.
    srp: z.number().min(0).optional(),
    discounts: z.array(z.any()).optional(),
    // Scenario 46 — per-line tax. VAT used to be collected once at the header,
    // which meant an AP bill carrying tax per line had nothing on the receipt
    // to match against line by line.
    taxCode: z.string().optional(),
    taxAmount: z.number().min(0).optional(),
    batchNumber: z.string().optional(),
    qualityHold: z.boolean(),
    // Doubles as the QC hold reason. The backend has no `qualityHoldReason`
    // column — `qualityHold` is a bare boolean — but every receipt line
    // already carries free-text `notes`, which was being collected and posted
    // with no UI ever able to set it. A held line that cannot say WHY forces
    // the inspector to go and ask, so the hold reason lands here.
    notes: z.string().max(500).optional(),
    // Not sent to the server — carried on the line purely so the refine()
    // below can enforce "every selected serial-tracked line needs a serial
    // per unit" without reaching into component state.
    selected: z.boolean(),
    isSerialTracked: z.boolean().optional(),
    // Serial-tracked items reject receiving unless serialNumbers is set
    // (stock.service.ts) — one supplier-provided serial per unit, typed in
    // by whoever is physically receiving the delivery.
    // Deliberately no per-element .min() here: element rules run on every
    // line, so an empty box on an *unticked* line failed validation and
    // blocked posting even though that line isn't being received.
    // Requiring a serial is the selection-aware job of superRefine below.
    serialNumbers: z.array(z.string()).optional(),
  })
  .superRefine((line, ctx) => {
    if (!line.selected) return

    if (line.quantityReceived <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a quantity, or untick this line',
        path: ['quantityReceived'],
      })
      return
    }

    if (line.isSerialTracked) {
      const serials = line.serialNumbers ?? []
      if (serials.length !== line.quantityReceived) {
        ctx.addIssue({
          code: 'custom',
          message: 'A serial number is required for every unit',
          path: ['serialNumbers'],
        })
        return
      }
      // Flag the specific blank units so a partly-filled multi-unit line
      // shows which box is missing, not just the first.
      serials.forEach((serial, unitIdx) => {
        if (serial.trim().length === 0) {
          ctx.addIssue({ code: 'custom', message: 'Required', path: ['serialNumbers', unitIdx] })
        }
      })
      return
    }

    if (
      line.serialNumbers &&
      line.serialNumbers.length > 0 &&
      line.serialNumbers.length !== line.quantityReceived
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'A serial number is required for every unit',
        path: ['serialNumbers'],
      })
    }
  })

export const ReceivePoFormSchema = z.object({
  warehouseId: z.string().min(1, 'Destination warehouse is required'),
  receivedAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
  // Document chain: PO -> DR from supplier -> Invoice (SI) from supplier ->
  // this Receiving Report. Both are the supplier's own paperwork, typed in
  // by whoever is physically receiving the delivery.
  // Scenario 46 — the DR is what's required, not the SI. The delivery receipt
  // is the paper the driver hands over WITH the goods, so it always exists at
  // receiving time; the supplier's invoice often follows days later, and the
  // client explicitly wants it editable when it arrives.
  deliveryReceiptNumber: z
    .string()
    .min(1, "Delivery receipt number is required — it's on the paper that came with the goods"),
  supplierInvoiceNumber: z.string().optional(),
  lines: z.array(ReceivePoLineSchema).min(1),
})

export type ReceivePoFormValues = z.infer<typeof ReceivePoFormSchema>
export type ReceivePoLine = ReceivePoFormValues['lines'][number]

/** Which drawer, if any, is open beneath a line. Only one at a time — the
 * row is already three columns of controls, and two open drawers under it
 * made it impossible to tell which line they belonged to. */
export type LineDrawer = 'serials' | 'pricing' | null
