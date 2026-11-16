'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { can } from '@/src/libs/guards/permission'

// Access Levels Part 2: which bank accounts, "Paid from" funds and Special
// Accounts a role may use. A role with no limits of a kind is unrestricted for
// that kind.

export type RoleScopeKind =
  | 'bank-account'
  | 'expense-fund'
  | 'expense-fund-own-branch'
  | 'special-account'

export type RoleScope = { kind: RoleScopeKind; targetId: string | null }

/** A role's limits. */
export async function getRoleScopes(roleId: string): Promise<ApiResponse<RoleScope[]>> {
  return api.get<RoleScope[]>(`/roles/${roleId}/scopes`)
}

/** Replaces a role's limits. */
export async function setRoleScopes(
  roleId: string,
  scopes: RoleScope[]
): Promise<ApiResponse<RoleScope[]>> {
  const session = await getSession()
  if (!session || !can(session, 'admin:roles:update')) {
    return { success: false, error: 'Forbidden', message: "You can't change a role's limits." }
  }
  const result = await api.post<RoleScope[]>(`/roles/${roleId}/scopes`, {
    scopes: scopes.map((s) => (s.targetId ? s : { kind: s.kind })),
  })
  if (result.success) revalidatePath(`/settings/roles/${roleId}/limits`)
  return result
}

/**
 * "Petty cash only" (ticket #66) pairs its permissions with the own-branch petty
 * cash limit, so "Paid from" offers only that fund. Adds the limit to what the
 * role already has, so named funds, bank accounts and Special Accounts the
 * Business Owner set on the limits page stay. Already there: nothing changes.
 */
export async function ensureOwnBranchPettyCashLimit(roleId: string): Promise<ApiResponse> {
  const current = await getRoleScopes(roleId)
  if (!current.success) return current
  const scopes = current.data ?? []
  if (scopes.some((s) => s.kind === 'expense-fund-own-branch')) return { success: true }
  return setRoleScopes(roleId, [...scopes, { kind: 'expense-fund-own-branch', targetId: null }])
}
