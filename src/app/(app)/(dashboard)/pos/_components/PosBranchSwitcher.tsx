'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Store } from 'lucide-react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { hasPrivilegedRole } from '@/src/libs/guards/permission'
import { getBranches, type Branch } from '../_actions/pos-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

export function PosBranchSwitcher() {
  const [visible, setVisible] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const { branchId, setBranch } = usePosBranchContext()

  useEffect(() => {
    getSessionOrNull().then((session) => {
      if (!session || !hasPrivilegedRole(session)) return
      setVisible(true)
      getBranches().then((res) => setBranches(res.data ?? []))
    })
  }, [])

  if (!visible) return null

  function handleChange(id: string) {
    if (!id) {
      setBranch(null)
      return
    }
    const branch = branches.find((b) => b.id === id)
    if (branch) setBranch(branch)
  }

  return (
    <div className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50/60 py-1 pl-2.5 pr-7 text-xs text-purple-800">
      <Store size={13} className="shrink-0 text-purple-500" />
      <select
        value={branchId ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none bg-transparent font-medium text-purple-800 focus:outline-none"
      >
        <option value="">All Branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={11}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-400"
      />
    </div>
  )
}
