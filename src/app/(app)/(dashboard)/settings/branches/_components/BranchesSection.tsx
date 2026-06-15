'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, LayoutGrid, List, MapPin, Plus, Users } from 'lucide-react'
import { BranchDetail } from '../../_actions/get-branches'
import CreateBranchModal from './CreateBranchModal'
import BranchListView from './BranchListView'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-zinc-100 text-zinc-500',
  closed: 'bg-red-100 text-red-600',
}

type View = 'grid' | 'list'

type Props = {
  initialBranches: BranchDetail[]
}

export default function BranchesSection({ initialBranches }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [view, setView] = useState<View>('grid')

  const activeBranches = initialBranches.filter((b) => b.status === 'active').length

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">Branches</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              View and manage your enterprise branches and their details.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-zinc-200 p-0.5">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`rounded-md p-1.5 transition ${view === 'grid' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`rounded-md p-1.5 transition ${view === 'list' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800"
            >
              <Plus className="h-4 w-4" />
              Add Branch
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Total Branches</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900">{initialBranches.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Active Branches</p>
            <p className="mt-1 text-3xl font-semibold text-green-600">{activeBranches}</p>
          </div>
        </div>

        {/* Content */}
        {view === 'list' ? (
          <BranchListView branches={initialBranches} onCreateClick={() => setIsModalOpen(true)} />
        ) : initialBranches.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
            <Building2 className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-sm text-zinc-500">
              No branches have been created. Create your first branch to get started.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-sm font-medium text-prominent-purple-700 hover:underline"
            >
              Create your first branch
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {initialBranches.map((branch) => {
              const employeeCount = branch.employeeCount ?? 0
              const managerName =
                branch.manager?.name?.trim() ||
                [branch.manager?.firstName, branch.manager?.lastName].filter(Boolean).join(' ') ||
                null

              return (
                <Link
                  key={branch.id}
                  href={`/settings/branches/${branch.id}`}
                  className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-zinc-900">
                        {branch.name}
                      </h2>
                      {branch.code && <p className="mt-0.5 text-xs text-zinc-400">{branch.code}</p>}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[branch.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                    >
                      {branch.status}
                    </span>
                  </div>

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

                  <div className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                    {managerName ? (
                      <span>
                        Manager: <span className="font-medium text-zinc-700">{managerName}</span>
                      </span>
                    ) : (
                      <span className="italic">No manager assigned</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <CreateBranchModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
