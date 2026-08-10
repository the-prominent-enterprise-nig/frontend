import { z } from 'zod'

export const DebitMemoTypeSchema = z.enum(['unit_replacement', 'billing_adjustment'])

export const CreateDebitMemoLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().positive('Unit price must be greater than 0'),
  serialNumberId: z.string().optional(),
  // Accepts '' (not just number|undefined) so the field can hold '' while
  // the user is actively clearing/retyping it (see DebitMemoLineRow's
  // onChange) without Zod rejecting the keystroke. handleFormSubmit's own
  // `additionAmount: l.additionAmount || undefined` mapping already
  // normalizes a leftover '' to undefined before it reaches the API.
  additionAmount: z.union([z.number().min(0, 'Cannot be negative'), z.literal('')]).optional(),
})

// Unlike CreditMemo, there's no "outstanding balance" ceiling to cross-field
// validate against — a debit memo only ever adds to what's owed, so a plain
// schema (not a per-render factory) is enough.
export const CreateDebitMemoFormSchema = z.object({
  type: DebitMemoTypeSchema,
  reason: z.string().max(1000).optional(),
  memoDate: z.string().min(1, 'Memo date is required'),
  lines: z.array(CreateDebitMemoLineSchema).min(1, 'At least one line is required'),
})

export type DebitMemoType = z.infer<typeof DebitMemoTypeSchema>
export type CreateDebitMemoLineValues = z.infer<typeof CreateDebitMemoLineSchema>
export type CreateDebitMemoFormValues = z.infer<typeof CreateDebitMemoFormSchema>
