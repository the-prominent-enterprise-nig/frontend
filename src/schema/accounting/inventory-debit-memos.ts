import { z } from 'zod'
import { DrPurposeSchema } from '@/src/schema/inventory/delivery-receipts'

// Scenario 72 — the internal DMINV debit memo (InventoryDebitMemo).

export const IDM_STATUSES = ['DRAFT', 'POSTED', 'VOID'] as const
export type IdmStatus = (typeof IDM_STATUSES)[number]

const decimal = z.union([z.string(), z.number()]).transform(Number)

export const IdmLineSchema = z.object({
  id: z.string(),
  lineNumber: z.number(),
  accountId: z.string(),
  description: z.string().nullable(),
  debit: decimal,
  credit: decimal,
  account: z.object({ id: z.string(), number: z.string(), name: z.string() }),
})

export const IdmDetailSchema = z.object({
  id: z.string(),
  memoNumber: z.string(),
  status: z.enum(IDM_STATUSES),
  purpose: DrPurposeSchema.nullable(),
  memoDate: z.string(),
  branchId: z.string().nullable(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable(),
  departmentId: z.string().nullable(),
  department: z.object({ id: z.string(), name: z.string() }).nullable(),
  referenceNo: z.string().nullable(),
  referenceDate: z.string().nullable(),
  reason: z.string().nullable(),
  journalEntryId: z.string().nullable(),
  postedAt: z.string().nullable(),
  voidedAt: z.string().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string(),
  deliveryReceiptId: z.string().nullable(),
  deliveryReceipt: z
    .object({
      id: z.string(),
      drNumber: z.string(),
      purpose: DrPurposeSchema,
      status: z.string(),
      warehouse: z.object({ id: z.string(), name: z.string() }),
    })
    .nullable(),
  lines: z.array(IdmLineSchema),
  totalDebit: z.number(),
  totalCredit: z.number(),
})
export type IdmDetail = z.infer<typeof IdmDetailSchema>

export const IdmListSchema = z.object({
  data: z.array(IdmDetailSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})
export type IdmList = z.infer<typeof IdmListSchema>

// ─── Editor form ──────────────────────────────────────────────────────────────

const IdmLineFormSchema = z.object({
  accountId: z.string().min(1, 'Pick an account'),
  description: z.string().max(500),
  debit: z.number().min(0),
  credit: z.number().min(0),
})

export const IdmFormSchema = z
  .object({
    memoDate: z.string().min(1, 'Date is required'),
    purpose: z.union([DrPurposeSchema, z.literal('')]),
    referenceNo: z.string().max(100),
    referenceDate: z.string(),
    reason: z.string().max(1000),
    lines: z.array(IdmLineFormSchema).min(2, 'A memo needs at least a debit and a credit line'),
  })
  .superRefine((v, ctx) => {
    v.lines.forEach((l, i) => {
      if (l.debit > 0 === l.credit > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'debit'],
          message: 'Enter a debit or a credit, not both',
        })
      }
    })
  })
export type IdmFormValues = z.infer<typeof IdmFormSchema>
export type IdmLineFormValues = IdmFormValues['lines'][number]
