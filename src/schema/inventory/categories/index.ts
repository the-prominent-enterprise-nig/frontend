import { z } from 'zod'

export const CategoryStatusSchema = z.enum(['active', 'inactive'])

export const CreateCategoryFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(500).optional(),
  parentCategoryId: z.string().optional(),
  displayOrder: z.number().int().min(0),
  status: CategoryStatusSchema,
  color: z.string().optional(),
  allowsCustomAttributes: z.boolean(),
  coverImageFileId: z.string().optional(),
})

export const UpdateCategoryFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(500).optional(),
  parentCategoryId: z.string().optional(),
  displayOrder: z.number().int().min(0),
  status: CategoryStatusSchema,
  color: z.string().optional(),
  allowsCustomAttributes: z.boolean(),
  coverImageFileId: z.string().optional(),
})

export type CreateCategoryFormValues = z.infer<typeof CreateCategoryFormSchema>
export type UpdateCategoryFormValues = z.infer<typeof UpdateCategoryFormSchema>

export interface CategoryCoverImage {
  id: string
  originalName: string
  mimeType: string
  size: number
  storageKey: string
  storageType: string
}

export interface CategoryNode {
  id: string
  name: string
  description?: string | null
  parentCategoryId?: string | null
  status?: 'active' | 'inactive'
  displayOrder?: number
  icon?: string | null
  color?: string | null
  path?: string | null
  coverImageFileId?: string | null
  coverImage?: CategoryCoverImage | null
  children?: CategoryNode[]
  _count?: { children: number; itemAssignments: number }
}

const CategoryCoverImageSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  storageKey: z.string(),
  storageType: z.string(),
})

export const CategoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    parentCategoryId: z.string().nullable().optional(),
    status: CategoryStatusSchema.optional(),
    displayOrder: z.number().optional(),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    path: z.string().nullable().optional(),
    coverImageFileId: z.string().nullable().optional(),
    coverImage: CategoryCoverImageSchema.nullable().optional(),
    children: z.array(CategoryNodeSchema).optional(),
    _count: z.object({ children: z.number(), itemAssignments: z.number() }).optional(),
  })
)

export const FlatCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  parentCategoryId: z.string().nullable().optional(),
  status: CategoryStatusSchema.optional(),
  displayOrder: z.number().optional(),
  color: z.string().nullable().optional(),
  coverImageFileId: z.string().nullable().optional(),
  coverImage: CategoryCoverImageSchema.nullable().optional(),
  _count: z.object({ children: z.number(), itemAssignments: z.number() }).optional(),
})

export const FlatCategoryListResponseSchema = z.object({
  data: z.array(FlatCategorySchema),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
})

export type FlatCategory = z.infer<typeof FlatCategorySchema>
export type FlatCategoryListResponse = z.infer<typeof FlatCategoryListResponseSchema>
