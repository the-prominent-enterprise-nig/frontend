import { z } from 'zod'

export const AttributeDataTypeEnum = z.enum([
  'text',
  'number',
  'boolean',
  'date',
  'dropdown',
  'multi_select',
])
export type AttributeDataType = z.infer<typeof AttributeDataTypeEnum>

export const AttributeDefinitionFormSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  attributeKey: z.string().min(1, 'Attribute key is required'),
  displayName: z.string().min(1, 'Display name is required'),
  dataType: AttributeDataTypeEnum,
  isRequired: z.boolean(),
  defaultValue: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
  displayOrder: z.number().int(),
})
export type AttributeDefinitionFormValues = z.infer<typeof AttributeDefinitionFormSchema>

export const AttributeDefinitionSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  attributeKey: z.string(),
  displayName: z.string(),
  dataType: AttributeDataTypeEnum,
  isRequired: z.boolean(),
  defaultValue: z.string().optional().nullable(),
  options: z.array(z.string()).optional().nullable(),
  displayOrder: z.number(),
  status: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const AttributeDefinitionListResponseSchema = z.object({
  data: z.array(AttributeDefinitionSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>
export type AttributeDefinitionListResponse = z.infer<typeof AttributeDefinitionListResponseSchema>
