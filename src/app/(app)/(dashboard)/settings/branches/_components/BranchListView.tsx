'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { BranchDetail } from '../../_actions/get-branches'

const TYPE_LABELS: Record<string, string> = {
  retail: 'Retail',
  warehouse: 'Warehouse',
  office: 'Office',
  mixed: 'Mixed',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-zinc-100 text-zinc-500',
  closed: 'bg-red-100 text-red-600',
}

type Props = {
  branches: BranchDetail[]
  onCreateClick: () => void
}

export default function BranchListView({ branches, onCreateClick }: Props) {
  const router = useRouter()
  if (branches.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
        <Building2 className="mx-auto h-10 w-10 text-zinc-300" />
        <p className="mt-3 text-sm text-zinc-500">
          No branches have been created. Create your first branch to get started.
        </p>
        <button
          type="button"
          onClick={onCreateClick}
          className="mt-4 text-sm font-medium text-prominent-purple-700 hover:underline"
        >
          Create your first branch
        </button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50">
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Name
            </th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Code
            </th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Type
            </th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Address
            </th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Manager
            </th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {branches.map((branch) => {
            const managerName =
              branch.manager?.name?.trim() ||
              [branch.manager?.firstName, branch.manager?.lastName].filter(Boolean).join(' ') ||
              null
            const address = [branch.addressLine1, branch.city].filter(Boolean).join(', ')

            return (
              <tr
                key={branch.id}
                className="group cursor-pointer transition hover:bg-zinc-50"
                onClick={() => router.push(`/settings/branches/${branch.id}`)}
              >
                <td className="px-5 py-4 font-medium text-zinc-900">{branch.name}</td>
                <td className="px-5 py-4 font-mono text-zinc-500">{branch.code ?? '—'}</td>
                <td className="px-5 py-4 text-zinc-600">
                  {TYPE_LABELS[branch.type] ?? branch.type}
                </td>
                <td className="max-w-50 truncate px-5 py-4 text-zinc-500">
                  {address || <span className="text-zinc-300">—</span>}
                </td>
                <td className="px-5 py-4 text-zinc-600">
                  {managerName ?? <span className="text-zinc-400">Unassigned</span>}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[branch.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                  >
                    {branch.status}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
