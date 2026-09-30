'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, IdCard, Pencil, Search, Trash2, UserPlus } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useEmployees } from '../_hooks/useEmployees'
import { removeEmployee } from '../_actions/remove-employee'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'

function fullName(e: { firstName: string; lastName: string; middleName?: string | null }) {
  return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
}

export default function EmployeesList({ session }: { session: SessionUser }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canCreate = hasPermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CREATE)
  const canEdit = hasPermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_UPDATE)
  const canDelete = hasPermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_DELETE)
  const { employees, total, isLoading, isFetching, error, search, setSearch } = useEmployees()

  const handleRemove = async (emp: (typeof employees)[number]) => {
    if (!confirm(`Remove ${fullName(emp)} from the Employees list? This can't be undone.`)) return
    const res = await removeEmployee(emp.id)
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['accounting-employees'] })
    } else {
      alert(res.message || res.error || 'Failed to remove the employee')
    }
  }

  const rowMenu = (emp: (typeof employees)[number]): RowMenuItem[] => [
    { label: 'View', icon: Eye, onClick: () => router.push(`/accounting/employees/${emp.id}`) },
    ...(canEdit
      ? [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => router.push(`/accounting/employees/${emp.id}/edit`),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: 'Remove',
            icon: Trash2,
            onClick: () => handleRemove(emp),
            variant: 'danger' as const,
          },
        ]
      : []),
  ]

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">Employees</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {total.toLocaleString()} employee{total === 1 ? '' : 's'} — the master list used to
              pick a borrower/payee and to create a linked customer.
            </p>
          </div>
          {canCreate && (
            <Link
              href="/accounting/employees/new"
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
            >
              <UserPlus className="h-4 w-4" />
              Add Employee
            </Link>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or employee code…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load employees</p>
          </div>
        )}

        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-24 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <IdCard className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No employees found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">Add an employee to start the list.</p>
              )}
            </div>
          ) : (
            <div className="scroll-fade-x overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Employee Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Contact
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                      onClick={() => (window.location.href = `/accounting/employees/${emp.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/accounting/employees/${emp.id}`}
                          className="font-mono text-xs text-prominent-purple-700 hover:underline"
                        >
                          {emp.employeeCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{fullName(emp)}</td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {emp.branch?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {emp.email || emp.contactNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowActionsMenu items={rowMenu(emp)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
