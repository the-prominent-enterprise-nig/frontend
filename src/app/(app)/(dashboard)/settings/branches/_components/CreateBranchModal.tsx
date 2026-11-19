'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { createBranch } from '../../_actions/create-branch'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { BRANCH_REGIONS, BRANCH_TYPES } from '@/src/schema/settings/create-branch'

type BranchRegion = (typeof BRANCH_REGIONS)[number]

const BRANCH_TYPE_LABELS: Record<(typeof BRANCH_TYPES)[number], string> = {
  retail: 'Retail',
  warehouse: 'Warehouse',
  office: 'Office',
  mixed: 'Mixed',
}

const REGION_OPTIONS: { value: BranchRegion; label: string }[] = [
  { value: 'panay', label: 'Panay' },
  { value: 'negros', label: 'Negros' },
]

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function CreateBranchModal({ isOpen, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [type, setType] = useState<(typeof BRANCH_TYPES)[number] | ''>('')
  const [address, setAddress] = useState('')
  const [region, setRegion] = useState<BranchRegion | ''>('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{
    name?: string
    type?: string
    region?: string
    general?: string
  }>({})
  // A 'warehouse'-type branch is the region's own warehouse, so it has none.
  const needsRegion = type !== '' && type !== 'warehouse'

  if (!isOpen) return null

  const reset = () => {
    setName('')
    setType('')
    setAddress('')
    setRegion('')
    setErrors({})
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const validate = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Branch name is required'
    if (!type) next.type = 'Branch type is required'
    if (needsRegion && !region) next.region = 'Region is required'
    return next
  }

  const handleSubmit = async () => {
    const fieldErrors = validate()
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    setErrors({})

    const result = await createBranch({
      name: name.trim(),
      type,
      address: address.trim() || undefined,
      region: needsRegion && region ? region : undefined,
    })

    setLoading(false)

    if (!result.success) {
      setErrors({ general: result.message || result.error || 'Something went wrong' })
      return
    }

    toast.success('Branch created successfully')
    reset()
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Create Branch</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Add a new branch to your enterprise.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 px-6 py-5">
          {errors.general && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
              {errors.general}
            </p>
          )}

          {/* Code — system-generated display */}
          <div>
            <p className="mb-0.5 text-sm font-medium text-zinc-700">Branch Code</p>
            <p className="text-sm text-zinc-500">
              Auto-generated — you can change it on the branch page after creating.
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Branch Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }))
              }}
              placeholder="e.g. Bago"
              maxLength={150}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                errors.name
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-zinc-200 focus:border-zinc-400'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Branch Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as typeof type)
                if (errors.type) setErrors((p) => ({ ...p, type: undefined }))
              }}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                errors.type
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-zinc-200 focus:border-zinc-400'
              }`}
            >
              <option value="">Select type…</option>
              {BRANCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BRANCH_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            {errors.type && <p className="mt-1 text-xs text-red-500">{errors.type}</p>}
          </div>

          {/* Region — decides which regional warehouse serves the branch */}
          {needsRegion && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Region <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={REGION_OPTIONS}
                value={region}
                onChange={(v) => {
                  setRegion(v as BranchRegion | '')
                  if (errors.region) setErrors((p) => ({ ...p, region: undefined }))
                }}
                placeholder="Select region…"
              />
              {errors.region && <p className="mt-1 text-xs text-red-500">{errors.region}</p>}
            </div>
          )}

          {/* Address */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 88 Ayala Ave, Makati, Manila"
              maxLength={255}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !type || (needsRegion && !region)}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Branch'}
          </button>
        </div>
      </div>
    </div>
  )
}
