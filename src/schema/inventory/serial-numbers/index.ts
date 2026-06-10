import { z } from 'zod'

export const SerialStatusSchema = z.enum(['in_stock', 'sold', 'returned', 'defective', 'scrapped'])
export type SerialStatus = z.infer<typeof SerialStatusSchema>

export const SERIAL_STATUS_LABELS: Record<SerialStatus, string> = {
  in_stock: 'In Stock',
  sold: 'Sold',
  returned: 'Returned',
  defective: 'Defective',
  scrapped: 'Scrapped',
}

export const SERIAL_STATUS_COLORS: Record<SerialStatus, string> = {
  in_stock: 'bg-green-100 text-green-700',
  sold: 'bg-blue-100 text-blue-700',
  returned: 'bg-yellow-100 text-yellow-700',
  defective: 'bg-red-100 text-red-700',
  scrapped: 'bg-zinc-100 text-zinc-600',
}

export const RegisterSerialsFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  serialNumbersText: z
    .string()
    .min(1, 'Enter at least one serial number')
    .transform((val) =>
      val
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
})

export const RegisterSerialsFormInputSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  serialNumbersText: z.string().min(1, 'Enter at least one serial number'),
})

export type RegisterSerialsFormInput = z.infer<typeof RegisterSerialsFormInputSchema>

export const UpdateSerialStatusFormSchema = z.object({
  status: SerialStatusSchema,
  warehouseId: z.string().optional(),
  soldToCustomerId: z.string().optional(),
  saleDate: z.string().optional(),
})
export type UpdateSerialStatusFormValues = z.infer<typeof UpdateSerialStatusFormSchema>

const SerialItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const SerialWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

export const SerialNumberSummarySchema = z.object({
  id: z.string(),
  serialNumber: z.string(),
  item: SerialItemSchema.optional().nullable(),
  warehouse: SerialWarehouseSchema.optional().nullable(),
  status: SerialStatusSchema,
  soldToCustomerId: z.string().optional().nullable(),
  saleDate: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const SerialNumberListResponseSchema = z.object({
  data: z.array(SerialNumberSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type SerialNumberSummary = z.infer<typeof SerialNumberSummarySchema>
export type SerialNumberListResponse = z.infer<typeof SerialNumberListResponseSchema>
