'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { X, CreditCard } from 'lucide-react'
import { useCreditApplications } from '../_hooks/useCreditApplications'
import { hasPermission } from '@/src/hooks/usePermission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  CREDIT_APPLICATION_STATUS_LABELS,
  CREDIT_APPLICATION_STATUS_COLORS,
  CreditApplicationStatusSchema,
  type CreditApplicationStatus,
} from '@/src/schema/credit/applications'
import { getBranches } from '../../_actions/pos-actions'
import CreateCreditApplicationModal from './CreateCreditApplicationModal'

export default function CreditApplicationList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, CREDIT_PERMISSIONS.APPLICATION_CREATE)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const {
    applications,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    createApplication,
    isCreating,
  } = useCreditApplications()

  const branchesQuery = useQuery({
    queryKey: ['branches-lookup'],
    queryFn: () => getBranches(),
    staleTime: 5 * 60 * 1000,
    enabled: !session.branchId,
  })

  const statusOptions = CreditApplicationStatusSchema.options

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Credit Applications</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Formal in-house financing applications, from intake through investigation and
              approval.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <CreditCard className="h-4 w-4" />
                New Application
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as CreditApplicationStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {CREDIT_APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {statusFilter && (
            <button
              type="button"
              onClick={() => setStatusFilter(undefined)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load credit applications</p>
          </div>
        )}

        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CreditCard className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No credit applications found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Open a new application to start a customer&apos;s in-house financing request.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Application #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Applicant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Co-Maker
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                        {app.applicationNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {app.applicantCustomer.name}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {app.coMaker.name}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900">
                        ₱{app.requestedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CREDIT_APPLICATION_STATUS_COLORS[app.status]}`}
                        >
                          {CREDIT_APPLICATION_STATUS_LABELS[app.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">
                        {app.branch.name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/pos/credit-applications/${app.id}`}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 font-medium text-zinc-700">
                {page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page >= pagination.totalPages}
                className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateCreditApplicationModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createApplication}
        isSubmitting={isCreating}
        sessionBranchId={session.branchId}
        branchOptions={branchesQuery.data?.data ?? []}
      />
    </div>
  )
}
