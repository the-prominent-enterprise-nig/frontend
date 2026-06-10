'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

export type CreatePermissionFormData = {
  module: string
  feature: string
  action: string
  description: string
}

type CreatePermissionModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreatePermissionFormData) => void
}

const COMMON_MODULES = ['hr', 'accounting', 'inventory', 'admin']

const FEATURES_BY_MODULE: Record<string, string[]> = {
  hr: ['employees', 'attendance', 'leave', 'payroll', 'payslips', 'documents'],
  accounting: ['invoices', 'expenses', 'journal', 'reports'],
  inventory: ['products', 'stock', 'adjustments', 'movements'],
  admin: ['roles', 'permissions', 'settings'],
}

const COMMON_ACTIONS = ['create', 'read', 'update', 'delete', 'manage', 'export', 'approve']

export default function CreatePermissionModal({
  isOpen,
  onClose,
  onSave,
}: CreatePermissionModalProps) {
  const [module, setModule] = useState('')
  const [feature, setFeature] = useState('')
  const [action, setAction] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<{ module?: string; feature?: string; action?: string }>({})

  if (!isOpen) return null

  const availableFeatures = module ? (FEATURES_BY_MODULE[module] ?? []) : []

  const validate = () => {
    const newErrors: { module?: string; feature?: string; action?: string } = {}
    if (!module.trim()) newErrors.module = 'Module is required.'
    if (!feature.trim()) newErrors.feature = 'Feature is required.'
    if (!action.trim()) newErrors.action = 'Action is required.'
    return newErrors
  }

  const handleSave = () => {
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSave({
      module: module.trim(),
      feature: feature.trim(),
      action: action.trim(),
      description: description.trim(),
    })
    setModule('')
    setFeature('')
    setAction('')
    setDescription('')
    setErrors({})
    onClose()
  }

  const handleClose = () => {
    setModule('')
    setFeature('')
    setAction('')
    setDescription('')
    setErrors({})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Create Permission</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Define a new permission using module, feature, and action.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 px-6 py-5">
          {/* Preview */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-500">Permission key preview</p>
            <p className="mt-1 font-mono text-sm font-semibold text-prominent-purple-700">
              {module || '<module>'}:{feature || '<feature>'}:{action || '<action>'}
            </p>
          </div>

          {/* Module */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Module <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_MODULES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setModule(m)
                    setFeature('')
                    if (errors.module) setErrors((prev) => ({ ...prev, module: undefined }))
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    module === m
                      ? 'bg-prominent-purple-700 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {errors.module && <p className="mt-1 text-xs text-red-500">{errors.module}</p>}
          </div>

          {/* Feature */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Feature <span className="text-red-500">*</span>
            </label>
            {availableFeatures.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {availableFeatures.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFeature(f)
                      if (errors.feature) setErrors((prev) => ({ ...prev, feature: undefined }))
                    }}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      feature === f
                        ? 'bg-prominent-purple-700 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Select a module first</p>
            )}
            {errors.feature && <p className="mt-1 text-xs text-red-500">{errors.feature}</p>}
          </div>

          {/* Action */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Action <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={action}
              onChange={(e) => {
                setAction(e.target.value.toLowerCase().replace(/\s+/g, '_'))
                if (errors.action) setErrors((prev) => ({ ...prev, action: undefined }))
              }}
              placeholder="e.g. create, read, approve"
              maxLength={100}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                errors.action
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-zinc-200 focus:border-zinc-400'
              }`}
            />
            {errors.action && <p className="mt-1 text-xs text-red-500">{errors.action}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMMON_ACTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAction(a)
                    if (errors.action) setErrors((prev) => ({ ...prev, action: undefined }))
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                    action === a
                      ? 'bg-prominent-purple-700 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this permission allows..."
              rows={2}
              maxLength={255}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">{description.length}/255</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800"
          >
            Create Permission
          </button>
        </div>
      </div>
    </div>
  )
}
