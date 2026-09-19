'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Select } from '@/src/components/ui/Select'
import { StatusBadge } from '@/src/components/ui/StatusBadge'
import { X, CreditCard, Search, Link2 } from 'lucide-react'
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

export default function CreditApplicationList({ session }: { session: SessionUser }) {
  const router = useRouter()
  const canCreate = hasPermission(session, CREDIT_PERMISSIONS.APPLICATION_CREATE)

  const {
    applications,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
  } = useCreditApplications()

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
              <Link
                href="/pos/credit-applications/new"
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <CreditCard className="h-4 w-4" />
                New Application
              </Link>
            )}
          </div>
        </div>

        {/* Filters sit in their own card, matching InstallmentAccountsList
            and the other refreshed list screens, instead of floating loose
            above the table. */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <div className="relative min-w-[16rem] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search application no., customer, or item/model…"
              aria-label="Search credit applications"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500"
            />
          </div>
          <div className="w-48">
            <Select
              value={statusFilter ?? ''}
              onChange={(v) =>
                setStatusFilter((v || undefined) as CreditApplicationStatus | undefined)
              }
              placeholder="All Statuses"
              options={[
                { value: '', label: 'All Statuses' },
                ...statusOptions.map((s) => ({
                  value: s,
                  label: CREDIT_APPLICATION_STATUS_LABELS[s],
                })),
              ]}
            />
          </div>
          {/* Clears the search box too — it previously only reset the status
              dropdown, so "Clear" left the queue still filtered by whatever
              was typed. */}
          {(statusFilter || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter(undefined)
                setSearch('')
              }}
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
              {/* "Nothing matched" and "nothing exists yet" are different
                  problems with different next steps — the single generic
                  message left the user unable to tell which they were
                  looking at. */}
              {search || statusFilter ? (
                <>
                  <p className="text-sm font-medium text-zinc-500">
                    No applications match your filters
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Try a different search term, or clear the filters above.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-500">No credit applications yet</p>
                  {canCreate && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Submit a new application to start a customer&apos;s in-house financing
                      request.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {/* Phones get stacked cards instead of a horizontally
                  scrolling table — the same split InstallmentAccountsList
                  uses. A cashier on a tablet at the counter shouldn't have
                  to scroll sideways to see an amount or status. */}
              <div className="divide-y divide-zinc-100 md:hidden">
                {applications.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => router.push(`/pos/credit-applications/${app.id}`)}
                    className="flex w-full flex-col gap-2 px-4 py-3 text-left active:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">
                          {app.applicantCustomer.name}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-500">
                          {app.applicationNumber}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge
                          label={CREDIT_APPLICATION_STATUS_LABELS[app.status]}
                          colorClassName={CREDIT_APPLICATION_STATUS_COLORS[app.status]}
                          size="xs"
                        />
                        {/* The desktop table shows this; the card was missing
                            it, so on a phone an already-consumed application
                            looked available. */}
                        {app.posTransactionId && (
                          <span
                            title={
                              app.posTransaction
                                ? `Consumed by sale ${app.posTransaction.transactionNumber}`
                                : 'Already used for a sale'
                            }
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500"
                          >
                            <Link2 className="h-2.5 w-2.5 shrink-0" />
                            Used
                            {app.posTransaction ? ` · ${app.posTransaction.transactionNumber}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-xs text-zinc-500">{app.branch.name}</span>
                      <span className="font-semibold text-zinc-900">
                        ₱
                        {Number(app.requestedAmount).toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {applications.map((app) => (
                      <tr
                        key={app.id}
                        onClick={() => router.push(`/pos/credit-applications/${app.id}`)}
                        className="cursor-pointer hover:bg-zinc-50"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                          {app.applicationNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {app.applicantCustomer.name}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                          {app.coMaker?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900">
                          ₱
                          {Number(app.requestedAmount).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StatusBadge
                              label={CREDIT_APPLICATION_STATUS_LABELS[app.status]}
                              colorClassName={CREDIT_APPLICATION_STATUS_COLORS[app.status]}
                            />
                            {/* Was solid black, which read as an alert sitting
                                under a soft status pill — it's a neutral fact,
                                not a warning, so it's muted to match. It has
                                to lead with the word: naming the sale alone
                                tells you where it went but not that it's
                                spent, which is the part that decides whether
                                this application can still be used. */}
                            {app.posTransactionId && (
                              <span
                                title={
                                  app.posTransaction
                                    ? `Consumed by sale ${app.posTransaction.transactionNumber}`
                                    : 'Already used for a sale'
                                }
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500"
                              >
                                <Link2 className="h-2.5 w-2.5 shrink-0" />
                                Used
                                {app.posTransaction
                                  ? ` · ${app.posTransaction.transactionNumber}`
                                  : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">
                          {app.branch.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
    </div>
  )
}
