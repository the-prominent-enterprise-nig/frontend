export const dynamic = 'force-dynamic'

import { api } from '@/src/libs/api/client'
import Link from 'next/link'
import { Users } from 'lucide-react'

interface Enterprise {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
  industry: string
  status: string
  _count: { users: number; branches: number }
}

interface EnterprisesResponse {
  data: Enterprise[]
  meta: { total: number; page: number; totalPages: number }
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  trial: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
}

export default async function AllAdminsPage() {
  const result = await api.get<EnterprisesResponse>('/super-admin/enterprises', {
    limit: '100',
    page: '1',
  })

  const enterprises = result.data?.data ?? []

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tenant Admins</h1>
        <p className="text-sm text-zinc-500">Manage admin users across all businesses.</p>
      </div>

      {enterprises.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16 dark:border-zinc-700 dark:bg-zinc-900">
          <Users className="mb-2 h-8 w-8 text-zinc-300" />
          <p className="text-sm text-zinc-400">No businesses found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 dark:border-zinc-800">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-3">Business Name</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {enterprises.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/super-admin/enterprises/${e.id}`}
                      className="font-medium text-zinc-900 hover:text-indigo-600 dark:text-zinc-100"
                    >
                      {e.companyTradingName ?? e.companyLegalName}
                    </Link>
                    {e.companyTradingName && (
                      <p className="text-xs text-zinc-400">{e.companyLegalName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{e.industry}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[e.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {e._count.users.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/super-admin/enterprises/${e.id}/admins`}
                      className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 dark:border-zinc-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950"
                    >
                      View Admins
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
