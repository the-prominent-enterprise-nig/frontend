import { z } from 'zod'

// Permission Schema (full permission object)
export const PermissionSchema = z.object({
  id: z.string(),
  module: z.string(),
  resource: z.string(),
  action: z.string(),
  description: z.string().nullable().optional(),
})

// Role Permission Schema (join table)
export const RolePermissionSchema = z.object({
  id: z.string(),
  permission: PermissionSchema,
})

// Role Schema (full role object)
export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  permissions: z.array(RolePermissionSchema),
})

// User Role Schema (join table)
export const UserRoleSchema = z.object({
  id: z.string(),
  role: RoleSchema,
})

// Session Employee Schema
export const SessionEmployeeSchema = z.object({
  id: z.string(),
  employeeCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().nullable().optional(),
  contactNumber: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  maritalStatus: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
})

// Session Branch Schema
export const SessionBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// User Branch Schema (join table)
export const UserBranchSchema = z.object({
  id: z.string(),
  branch: SessionBranchSchema,
})

// User Schema (matches API response from backend)
export const UserSchema = z.object({
  id: z.string(),
  auth0Id: z.string().nullable(),
  email: z.string().email(),
  name: z.string().nullable(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  isActive: z.boolean(),
  employeeId: z.string().nullable(),
  employee: SessionEmployeeSchema.nullable(),
  userBranches: z.array(UserBranchSchema),
  userRoles: z.array(UserRoleSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// Meta Schema for pagination
export const MetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(10),
  lastPage: z.number().int().nonnegative(),
})

// Query Params Schema (used for all list endpoints)
export const QueryParamsSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

// User List Response Schema
export const UserListResponseSchema = z
  .object({
    data: z.array(UserSchema),
    meta: MetaSchema.optional(),
  })
  .or(z.array(UserSchema)) // Support both paginated and simple array responses

// Permission List Response Schema
export const PermissionListResponseSchema = z
  .object({
    data: z.array(PermissionSchema),
    meta: MetaSchema.optional(),
  })
  .or(z.array(PermissionSchema))

// Role List Response Schema
export const RoleListResponseSchema = z
  .object({
    data: z.array(RoleSchema),
    meta: MetaSchema.optional(),
  })
  .or(z.array(RoleSchema))

// Type exports
export type Permission = z.infer<typeof PermissionSchema>
export type RolePermission = z.infer<typeof RolePermissionSchema>
export type Role = z.infer<typeof RoleSchema>
export type UserRole = z.infer<typeof UserRoleSchema>
export type User = z.infer<typeof UserSchema>
export type SessionEmployee = z.infer<typeof SessionEmployeeSchema>
export type SessionBranch = z.infer<typeof SessionBranchSchema>
export type UserBranch = z.infer<typeof UserBranchSchema>
export type UserListResponse = z.infer<typeof UserListResponseSchema>
export type PermissionListResponse = z.infer<typeof PermissionListResponseSchema>
export type RoleListResponse = z.infer<typeof RoleListResponseSchema>
export type QueryParams = z.infer<typeof QueryParamsSchema>
export type UserQueryParams = QueryParams
export type Meta = z.infer<typeof MetaSchema>
