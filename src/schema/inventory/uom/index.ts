import { z } from 'zod'

export const CreateUomFormSchema = z
  .object({
    code: z
      .string()
      .min(1, 'Code is required')
      .max(20)
      .regex(
        /^[A-Za-z0-9_\-]+$/,
        'Code may only contain letters, numbers, hyphens, and underscores'
      ),
    name: z.string().min(1, 'Name is required').max(80),
    isBaseUnit: z.boolean(),
    allowDecimal: z.boolean().optional(),
    baseUnitId: z.string().optional(),
    conversionFactor: z.number().positive('Conversion factor must be positive').optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.isBaseUnit) {
      if (!val.baseUnitId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Base unit is required for a derived unit',
          path: ['baseUnitId'],
        })
      }
      if (!val.conversionFactor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Conversion factor is required for a derived unit',
          path: ['conversionFactor'],
        })
      }
    }
  })

export const UpdateUomFormSchema = z
  .object({
    code: z
      .string()
      .min(1, 'Code is required')
      .max(20)
      .regex(
        /^[A-Za-z0-9_\-]+$/,
        'Code may only contain letters, numbers, hyphens, and underscores'
      ),
    name: z.string().min(1, 'Name is required').max(80),
    isBaseUnit: z.boolean(),
    allowDecimal: z.boolean().optional(),
    baseUnitId: z.string().optional(),
    conversionFactor: z.number().positive('Conversion factor must be positive').optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.isBaseUnit) {
      if (!val.baseUnitId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Base unit is required for a derived unit',
          path: ['baseUnitId'],
        })
      }
      if (!val.conversionFactor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Conversion factor is required for a derived unit',
          path: ['conversionFactor'],
        })
      }
    }
  })

export type CreateUomFormValues = z.infer<typeof CreateUomFormSchema>
export type UpdateUomFormValues = z.infer<typeof UpdateUomFormSchema>

// Full UOM record returned by the API
export const UomRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  isBaseUnit: z.boolean().optional(),
  allowDecimal: z.boolean().optional(),
  baseUnitId: z.string().optional().nullable(),
  conversionFactor: z.coerce.number().optional().nullable(),
  baseUnit: z.object({ id: z.string(), code: z.string(), name: z.string() }).optional().nullable(),
  derivedUnits: z
    .array(
      z.object({
        id: z.string(),
        code: z.string(),
        name: z.string(),
        conversionFactor: z.coerce.number().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
})

export const UomListResponseSchema = z.object({
  data: z.array(UomRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type UomRecord = z.infer<typeof UomRecordSchema>
export type UomListResponse = z.infer<typeof UomListResponseSchema>
