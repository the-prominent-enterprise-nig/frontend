import { z } from 'zod'

export const ScopeTypeSchema = z.enum(['ALL', 'BRANCH', 'DEPARTMENT'])

export const UserAuditLogSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorName: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable().optional(),
  resourceName: z.string().nullable().optional(),
  scopeType: ScopeTypeSchema,
  scopeBranchId: z.string().nullable().optional(),
  scopeDepartmentId: z.string().nullable().optional(),
  enterpriseOwnerId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string(),
})

export const AuditLogMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  lastPage: z.number(),
})

export const AuditLogListResponseSchema = z.object({
  data: z.array(UserAuditLogSchema),
  meta: AuditLogMetaSchema,
})

export const AuditLogQueryParamsSchema = z.object({
  actorId: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

export type ScopeType = z.infer<typeof ScopeTypeSchema>
export type UserAuditLog = z.infer<typeof UserAuditLogSchema>
export type AuditLogMeta = z.infer<typeof AuditLogMetaSchema>
export type AuditLogListResponse = z.infer<typeof AuditLogListResponseSchema>
export type AuditLogQueryParams = z.infer<typeof AuditLogQueryParamsSchema>
