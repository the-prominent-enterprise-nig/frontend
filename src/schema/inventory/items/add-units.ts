import { z } from 'zod'
import { UnitClassificationSchema } from '@/src/schema/inventory/reports'

/** One serial per line, or comma-separated; blanks dropped. */
export function parseSerialList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function repeatedSerials(serials: string[]): string[] {
  return [...new Set(serials.filter((s, i) => serials.indexOf(s) !== i))]
}

/** Item Master → Add units: already-in-hand units of an existing item that
 * the beginning-balance upload missed, recorded at one branch under one RR #. */
export const AddUnitsFormSchema = z
  .object({
    warehouseId: z.string().min(1, 'Branch is required'),
    // Blank date = today, blank RR # = generated (same as Add Item / upload).
    dateIn: z.string(),
    rr: z.string().trim().max(30, 'RR number must be 30 characters or fewer'),
    origin: z.string().optional(),
    classification: UnitClassificationSchema,
    price: z.number().min(0).optional(),
    serialsText: z.string(),
    // The item's own flag, carried so the serials rule can follow it.
    isSerialTracked: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const serials = parseSerialList(data.serialsText)
    if (!data.isSerialTracked) {
      if (serials.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['serialsText'],
          message: 'Remove the serials — this item is not serial-tracked',
        })
      }
      return
    }
    if (serials.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['serialsText'],
        message: 'Enter at least one serial number — this item is serial-tracked',
      })
      return
    }
    const repeated = repeatedSerials(serials)
    if (repeated.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['serialsText'],
        message: `Listed more than once: ${repeated.join(', ')}`,
      })
    }
  })

export type AddUnitsFormValues = z.infer<typeof AddUnitsFormSchema>
