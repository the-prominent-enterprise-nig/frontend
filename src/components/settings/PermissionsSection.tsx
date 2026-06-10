'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, MoreHorizontal } from 'lucide-react'
import CreatePermissionModal, { type CreatePermissionFormData } from './CreatePermissionModal'
import { type Permission } from '@/src/schema/settings/list'
import { createPermission } from '@/src/app/(app)/(dashboard)/settings/_actions'
import { showToast } from '@/src/components/ui/toast'

type PermissionsSectionProps = {
  initialPermissions: Permission[]
}

export default function PermissionsSection({ initialPermissions }: PermissionsSectionProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('All')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return initialPermissions.filter((p) => {
      const q = search.toLowerCase()
      const key = `${p.module}:${p.resource}:${p.action}`
      const matchesSearch =
        key.includes(q) || (p.description && p.description.toLowerCase().includes(q))
      const matchesModule = moduleFilter === 'All' || p.module === moduleFilter
      return matchesSearch && matchesModule
    })
  }, [initialPermissions, search, moduleFilter])

  const handleCreate = async (data: CreatePermissionFormData) => {
    try {
      // Map 'feature' to 'resource' as the API expects
      const result = await createPermission({
        module: data.module,
        resource: data.feature,
        action: data.action,
        description: data.description || undefined,
      })

      if (!result.success) {
        showToast({
          title: 'Failed to create permission',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }

      showToast({
        title: 'Permission created successfully',
        description: `${result.data?.module}:${result.data?.resource}:${result.data?.action} has been added`,
        status: 'success',
      })

      // Refresh server data and close modal
      router.refresh()
      setIsCreateOpen(false)
    } catch (error) {
      showToast({
        title: 'Failed to create permission',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    }
  }

  const handleDelete = (id: string) => {
    // TODO: Implement delete permission API call
    console.log('Delete permission:', id)
    setOpenMenu(null)
  }

  const modules = ['All', ...Array.from(new Set(initialPermissions.map((p) => p.module)))]

  return (
    <>
      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            placeholder="Search by key or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 lg:max-w-sm"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            >
              {modules.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800"
            >
              + Add Permission
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Permission Key</th>
                <th className="px-4 py-3 text-left font-medium">Module</th>
                <th className="px-4 py-3 text-left font-medium">Resource</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((permission, index) => {
                  const isNearBottom = index >= filtered.length - 3
                  return (
                    <tr key={permission.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs font-semibold text-prominent-purple-700">
                          {permission.module}:{permission.resource}:{permission.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{permission.module}</td>
                      <td className="px-4 py-3 text-zinc-700">{permission.resource}</td>
                      <td className="px-4 py-3 text-zinc-700">{permission.action}</td>
                      <td className="max-w-xs px-4 py-3 text-zinc-600">
                        {permission.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">—</td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenu(openMenu === permission.id ? null : permission.id)
                            }
                            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenu === permission.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setOpenMenu(null)}
                              />
                              <div
                                className={`absolute right-0 z-50 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'} w-36 rounded-xl border border-zinc-200 bg-white shadow-lg`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDelete(permission.id)}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                    No permissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreatePermissionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreate}
      />
    </>
  )
}
