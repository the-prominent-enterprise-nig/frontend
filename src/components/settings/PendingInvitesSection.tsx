'use client'

import { useState } from 'react'
import {
  MoreHorizontal,
  Shield,
  ChevronLeft,
  ChevronRight,
  Send,
  Ban,
  Mail,
  Copy,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import EditPendingEmailModal from './EditPendingEmailModal'
import { getInviteStatus, INVITE_STATUS_LABEL, INVITE_STATUS_CLASS } from './invite-status'
import { type User } from '@/src/schema/settings/list'
import { resendInvite } from '@/src/app/(app)/(dashboard)/settings/_actions/resend-invite'
import { revokeInvite } from '@/src/app/(app)/(dashboard)/settings/_actions/revoke-invite'
import { getInviteLink } from '@/src/app/(app)/(dashboard)/settings/_actions/get-invite-link'
import { showToast } from '@/src/components/ui/toast'

type OpenMenu = string | null
type Meta = { total: number; page: number; limit: number; totalPages?: number; lastPage?: number }

type PendingInvitesSectionProps = {
  users: User[]
  meta?: Meta
  canManage?: boolean
}

export default function PendingInvitesSection({
  users,
  meta,
  canManage = false,
}: PendingInvitesSectionProps) {
  const router = useRouter()
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [editEmailTarget, setEditEmailTarget] = useState<User | null>(null)

  const totalPages = meta?.totalPages ?? meta?.lastPage ?? 1
  const currentPage = meta?.page ?? 1

  const handleResendInvite = async (user: User) => {
    setOpenMenu(null)
    const result = await resendInvite(user.id)
    if (result.success) {
      showToast({
        title: 'Invite resent',
        description: `A fresh invite was sent to ${user.email}.`,
        status: 'success',
      })
      router.refresh()
    } else {
      showToast({
        title: 'Failed to resend invite',
        description: `${result.error ?? 'Please try again.'} You can still copy the invite link directly and share it yourself.`,
        status: 'error',
      })
    }
  }

  const handleCopyInviteLink = async (user: User) => {
    setOpenMenu(null)
    const result = await getInviteLink(user.id)
    if (!result.success || !result.data) {
      showToast({
        title: 'Failed to get invite link',
        description: result.error ?? 'Please try again.',
        status: 'error',
      })
      return
    }
    if (result.data.expired) {
      showToast({
        title: 'This invite has expired',
        description: 'Use Resend Invite to generate a fresh link before sharing it.',
        status: 'error',
      })
      return
    }
    try {
      await navigator.clipboard.writeText(result.data.inviteUrl)
      showToast({
        title: 'Link copied',
        description: `Share it with ${user.email} directly — no email required.`,
        status: 'success',
      })
    } catch {
      showToast({
        title: 'Could not copy automatically',
        description: result.data.inviteUrl,
        status: 'error',
      })
    }
  }

  const handleRevokeInvite = async (user: User) => {
    setOpenMenu(null)
    const result = await revokeInvite(user.id)
    if (result.success) {
      showToast({
        title: 'Invite revoked',
        description: `${user.email} can no longer use their invite link.`,
        status: 'success',
      })
      router.refresh()
    } else {
      showToast({
        title: 'Failed to revoke invite',
        description: result.error ?? 'Please try again.',
        status: 'error',
      })
    }
  }

  const handleEditEmail = (user: User) => {
    setEditEmailTarget(user)
    setOpenMenu(null)
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Pending Invites</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              People who&apos;ve been invited but haven&apos;t finished setting up their account
              yet.
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="border-t border-zinc-100">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invited</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Sent</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  {canManage && <th className="px-4 py-3 text-left font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user, index) => {
                    const isNearBottom = index >= users.length - 3
                    const displayName =
                      (user.name && user.name.trim()) ||
                      (user.firstName || user.lastName
                        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
                        : null) ||
                      'N/A'
                    const userRoles = user.userRoles.map((ur) => ur.role.name)
                    const rolesDisplay = userRoles.length > 0 ? userRoles.join(', ') : 'No roles'
                    const branchName =
                      user.employee?.branch?.name ??
                      user.userBranches[0]?.branch.name ??
                      'Head Office'
                    const invitedDate = new Date(user.createdAt).toLocaleDateString()
                    const inviteStatus = getInviteStatus(user)

                    return (
                      <tr key={user.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-zinc-900">{displayName}</span>
                            <span className="text-xs text-zinc-500">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-zinc-500" />
                            <span className="text-zinc-700">
                              {rolesDisplay} · {branchName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{invitedDate}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${INVITE_STATUS_CLASS[inviteStatus]}`}
                          >
                            {INVITE_STATUS_LABEL[inviteStatus]}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                disabled={inviteStatus === 'expired'}
                                onClick={() => handleCopyInviteLink(user)}
                                title={
                                  inviteStatus === 'expired'
                                    ? 'Invite expired — resend to get a new link'
                                    : 'Copy invite link'
                                }
                                className="rounded-lg border border-prominent-orange-500 bg-prominent-orange-100 p-1.5 text-prominent-orange-700 transition hover:bg-prominent-orange-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-prominent-orange-100"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {openMenu === user.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setOpenMenu(null)}
                                    />
                                    <div
                                      className={`absolute right-0 z-50 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleResendInvite(user)}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                                      >
                                        <Send className="h-4 w-4" />
                                        Resend Invite
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEditEmail(user)}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                                      >
                                        <Mail className="h-4 w-4" />
                                        Edit Email
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRevokeInvite(user)}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                                      >
                                        <Ban className="h-4 w-4" />
                                        Revoke Invite
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={canManage ? 5 : 4}
                      className="px-4 py-12 text-center text-zinc-500"
                    >
                      No pending invites — everyone&apos;s set up.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {meta && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm text-zinc-500">
          <span>
            {meta.total === 0
              ? 'No pending invites'
              : `Showing ${(currentPage - 1) * meta.limit + 1}–${Math.min(currentPage * meta.limit, meta.total)} of ${meta.total} pending invites`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              {currentPage > 1 ? (
                <Link
                  href={`/settings/pending-invites?page=${currentPage - 1}`}
                  className="flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md border border-zinc-100 px-3 py-1.5 text-xs text-zinc-300">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </span>
              )}
              {currentPage < totalPages ? (
                <Link
                  href={`/settings/pending-invites?page=${currentPage + 1}`}
                  className="flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md border border-zinc-100 px-3 py-1.5 text-xs text-zinc-300">
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {editEmailTarget && (
        <EditPendingEmailModal
          user={editEmailTarget}
          isOpen={true}
          onClose={() => setEditEmailTarget(null)}
        />
      )}
    </>
  )
}
