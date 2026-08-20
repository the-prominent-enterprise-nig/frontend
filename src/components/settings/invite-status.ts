import { type User } from '@/src/schema/settings/list'

export type InviteStatus = 'active' | 'inactive' | 'pending' | 'expired'

/**
 * PENDING_SETUP + isActive is a claimable invite; PENDING_SETUP + !isActive
 * means the invite was revoked before it was ever claimed (see
 * UsersService.revokeInvite, which reuses the INACTIVE status rather than
 * adding a dedicated enum value).
 */
export function getInviteStatus(user: User): InviteStatus {
  if (user.status === 'PENDING_SETUP' && user.isActive) {
    const invite = user.businessInvites[0]
    if (invite && !invite.usedAt && new Date(invite.expiresAt) < new Date()) {
      return 'expired'
    }
    return 'pending'
  }
  return user.isActive ? 'active' : 'inactive'
}

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  expired: 'Expired',
}

export const INVITE_STATUS_CLASS: Record<InviteStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-zinc-100 text-zinc-600',
  pending: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
}
