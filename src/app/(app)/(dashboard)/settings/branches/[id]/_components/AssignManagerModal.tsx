'use client'

import { useState, useEffect } from 'react'
import { Search, X, UserCheck } from 'lucide-react'
import { getUsers } from '../../../_actions/get-users'
import { User } from '@/src/schema/settings/list'

type Props = {
  isOpen: boolean
  currentManagerIds: Set<string>
  onClose: () => void
  onAssign: (userId: string) => Promise<void>
  isSubmitting: boolean
}

export default function AssignManagerModal({
  isOpen,
  currentManagerIds,
  onClose,
  onAssign,
  isSubmitting,
}: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setSearch('')
    setSelectedId(null)

    const fetchUsers = async () => {
      setLoading(true)
      const result = await getUsers({ page: 1, limit: 200, status: 'ACTIVE' })
      setLoading(false)

      if (result.success && result.data) {
        const raw = Array.isArray(result.data) ? result.data : ((result.data as any).data ?? [])
        setUsers(raw.filter((u: User) => u.isActive))
      }
    }

    fetchUsers()
  }, [isOpen])

  if (!isOpen) return null

  const filtered = users.filter((u) => {
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || ''
    const q = search.toLowerCase()
    return fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const canAssign = selectedId !== null && !currentManagerIds.has(selectedId)

  const getUserDisplay = (u: User) => ({
    fullName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email,
    initials: (
      [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('') ||
      u.name?.[0] ||
      u.email[0]
    ).toUpperCase(),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Assign Branch Manager</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 focus-within:border-zinc-400">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              autoFocus
            />
          </div>
        </div>

        {/* User list */}
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-zinc-400">
              Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-zinc-400">
              {search ? 'No users match your search.' : 'No active users found.'}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {filtered.map((u) => {
                const { fullName, initials } = getUserDisplay(u)
                const isCurrent = currentManagerIds.has(u.id)
                const isSelected = u.id === selectedId

                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(isCurrent ? null : u.id)}
                      disabled={isCurrent}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        isCurrent
                          ? 'cursor-default opacity-50'
                          : isSelected
                            ? 'bg-prominent-purple-700/5'
                            : 'hover:bg-zinc-50'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          isSelected
                            ? 'bg-prominent-purple-700 text-white'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{fullName}</p>
                        <p className="truncate text-xs text-zinc-500">{u.email}</p>
                      </div>

                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                          Already assigned
                        </span>
                      )}
                      {isSelected && !isCurrent && (
                        <UserCheck className="h-4 w-4 shrink-0 text-prominent-purple-700" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedId && onAssign(selectedId)}
            disabled={!canAssign || isSubmitting}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Assigning…' : 'Assign Manager'}
          </button>
        </div>
      </div>
    </div>
  )
}
