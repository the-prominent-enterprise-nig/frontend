import { z } from 'zod'

export const BARCODE_TYPES = ['upc', 'ean13', 'code128', 'qr', 'custom'] as const
export type BarcodeType = (typeof BARCODE_TYPES)[number]

export const BarcodeTypeSchema = z.enum(BARCODE_TYPES)

export const BarcodeRecordSchema = z.object({
  id: z.string(),
  barcode: z.string(),
  barcodeType: BarcodeTypeSchema,
  itemId: z.string(),
  variantId: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  createdAt: z.string().optional(),
})

export const CreateBarcodeFormSchema = z.object({
  barcode: z.string().min(1, 'Barcode value is required'),
  barcodeType: BarcodeTypeSchema,
  variantId: z.string().optional(),
})

export const GenerateBarcodeFormSchema = z.object({
  barcodeType: BarcodeTypeSchema,
  variantId: z.string().optional(),
})

export const BulkGenerateFormSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'Select at least one item'),
  barcodeType: BarcodeTypeSchema,
})

export type BarcodeRecord = z.infer<typeof BarcodeRecordSchema>
export type CreateBarcodeFormValues = z.infer<typeof CreateBarcodeFormSchema>
export type GenerateBarcodeFormValues = z.infer<typeof GenerateBarcodeFormSchema>
export type BulkGenerateFormValues = z.infer<typeof BulkGenerateFormSchema>
