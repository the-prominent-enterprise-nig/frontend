import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { redirect } from 'next/navigation'
import { getBranches } from '../_actions/get-branches'
import { MapPin, Users, Building2 } from 'lucide-react'

export const metadata = {
  title: 'Branches | Prominent Enterprise',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-zinc-100 text-zinc-500',
  closed: 'bg-red-100 text-red-600',
}

export default async function BranchesSettingsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const result = await getBranches()
  const branches = result.success && result.data ? result.data : []

  const activeBranches = branches.filter((b) => b.status === 'active').length

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-zinc-900">Branches</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            View and manage your enterprise branches and their details.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Total Branches</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900">{branches.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Active Branches</p>
            <p className="mt-1 text-3xl font-semibold text-green-600">{activeBranches}</p>
          </div>
        </div>

        {/* Branch cards */}
        {branches.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
            <Building2 className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-zinc-500">No branches found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch) => {
              const employeeCount = branch.employeeCount ?? 0
              const managerName =
                branch.manager?.name?.trim() ||
                [branch.manager?.firstName, branch.manager?.lastName].filter(Boolean).join(' ') ||
                null

              return (
                <div
                  key={branch.id}
                  className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-zinc-900">
                        {branch.name}
                      </h2>
                      {branch.code && (
                        <p className="mt-0.5 font-mono text-xs text-zinc-400">{branch.code}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[branch.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                    >
                      {branch.status}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="mt-4 space-y-2 text-sm text-zinc-600">
                    {(branch.addressLine1 || branch.city) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                        <span>{[branch.addressLine1, branch.city].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="font-medium text-zinc-800">{employeeCount}</span>
                      <span>{employeeCount === 1 ? 'employee' : 'employees'}</span>
                    </div>
                  </div>

                  {/* Manager */}
                  <div className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                    {managerName ? (
                      <span>
                        Manager: <span className="font-medium text-zinc-700">{managerName}</span>
                      </span>
                    ) : (
                      <span className="italic">No manager assigned</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
