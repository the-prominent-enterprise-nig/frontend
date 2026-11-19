import { z } from 'zod'
import { UnitClassificationSchema } from '@/src/schema/inventory/reports'

/** One serial per line, or comma-separated; blanks dropped. */
export function parseSerialList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** The backend keeps quantities to 4 decimals (Decimal(18,4)). */
function hasAtMostFourDecimals(n: number): boolean {
  return Math.abs(n * 10_000 - Math.round(n * 10_000)) < 1e-6
}

/** A non-serial item (rice, by the KG) says how much is on hand. */
function quantityIssue(quantity: number | undefined): string | null {
  if (quantity === undefined || !(quantity > 0)) return 'Enter the quantity on hand'
  if (!hasAtMostFourDecimals(quantity)) return 'Use at most 4 decimal places'
  return null
}

/** One branch's opening stock — its own receipt, RR #, date in, origin,
 * cost and classification. A serial item lists its units by serial; a
 * non-serial one (rice) gives a quantity, optionally counted in a unit built
 * on its own (SACK = 5 KG). */
export const BranchRowSchema = z.object({
  warehouseId: z.string(),
  rr: z.string().trim().max(30, 'RR number must be 30 characters or fewer'),
  /** Blank = today. */
  dateIn: z.string().optional(),
  /** Blank = WHSE (internal stock). */
  origin: z.string().optional(),
  price: z.number().min(0).optional(),
  /** Serial items: the Stockbook Classification of this branch's units. */
  classification: UnitClassificationSchema,
  /** Serial items: one serial per line, or comma-separated. */
  serialsText: z.string(),
  /** Non-serial items: how much, in `unitId` (blank = the item's own unit). */
  quantity: z.number().optional(),
  unitId: z.string().optional(),
})

export type BranchRow = z.infer<typeof BranchRowSchema>

export const EMPTY_BRANCH_ROW: BranchRow = {
  warehouseId: '',
  rr: '',
  dateIn: '',
  origin: '',
  price: undefined,
  classification: 'brand_new',
  serialsText: '',
  quantity: undefined,
  unitId: '',
}

type IssueContext = z.RefinementCtx

function issue(ctx: IssueContext, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: 'custom', path, message })
}

/** A branch picked once; a typed RR # used once (each branch is its own receipt). */
function checkBranchAndRr(rows: BranchRow[], ctx: IssueContext): void {
  rows.forEach((row, i) => {
    if (!row.warehouseId) issue(ctx, ['branches', i, 'warehouseId'], 'Pick a branch')
    else if (rows.findIndex((r) => r.warehouseId === row.warehouseId) !== i) {
      issue(ctx, ['branches', i, 'warehouseId'], 'Branch listed twice')
    }
    if (row.rr && rows.findIndex((r) => r.rr === row.rr) !== i) {
      issue(ctx, ['branches', i, 'rr'], 'RR # used on another row')
    }
  })
}

/** Every row lists serials; no serial twice, in a row or across rows. */
function checkSerials(rows: BranchRow[], ctx: IssueContext): void {
  const seen = new Set<string>()
  rows.forEach((row, i) => {
    const serials = parseSerialList(row.serialsText)
    if (serials.length === 0) {
      issue(ctx, ['branches', i, 'serialsText'], 'Enter at least one serial number')
      return
    }
    const repeated = [...new Set(serials.filter((s, j) => serials.indexOf(s) !== j || seen.has(s)))]
    if (repeated.length > 0) {
      issue(ctx, ['branches', i, 'serialsText'], `Listed more than once: ${repeated.join(', ')}`)
    }
    serials.forEach((s) => seen.add(s))
  })
}

function checkQuantities(rows: BranchRow[], ctx: IssueContext): void {
  rows.forEach((row, i) => {
    const problem = quantityIssue(row.quantity)
    if (problem) issue(ctx, ['branches', i, 'quantity'], problem)
  })
}

/** Item Master → Add units: units already on hand, recorded outside
 * receiving, at one or more branches — one receipt per branch, all saved
 * together or not at all. */
export const AddUnitsFormSchema = z
  .object({
    branches: z.array(BranchRowSchema),
    // The item's own flag, carried so the rules can follow it.
    isSerialTracked: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.branches.length === 0) {
      issue(ctx, ['branches'], 'Add at least one branch')
      return
    }
    checkBranchAndRr(data.branches, ctx)
    if (data.isSerialTracked) checkSerials(data.branches, ctx)
    else checkQuantities(data.branches, ctx)
  })

export type AddUnitsFormValues = z.infer<typeof AddUnitsFormSchema>
