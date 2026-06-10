import { z } from 'zod'

export const ReservationReferenceTypeEnum = z.enum(['quotation', 'sales_order'])
export type ReservationReferenceType = z.infer<typeof ReservationReferenceTypeEnum>

export const ReservationFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  reservedQty: z.number().positive('Reserved quantity must be greater than 0'),
  referenceType: ReservationReferenceTypeEnum,
  referenceId: z.string().min(1, 'Reference ID is required'),
  expiresAt: z.string().min(1, 'Expiry date/time is required'),
})
export type ReservationFormValues = z.infer<typeof ReservationFormSchema>

const ReservationItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const ReservationWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

export const ReservationSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: ReservationItemSchema.optional().nullable(),
  warehouseId: z.string(),
  warehouse: ReservationWarehouseSchema.optional().nullable(),
  reservedQty: z.number(),
  referenceType: ReservationReferenceTypeEnum,
  referenceId: z.string(),
  expiresAt: z.string(),
  status: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const ReservationListResponseSchema = z.object({
  data: z.array(ReservationSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type Reservation = z.infer<typeof ReservationSchema>
export type ReservationListResponse = z.infer<typeof ReservationListResponseSchema>
