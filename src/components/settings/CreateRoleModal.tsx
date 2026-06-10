'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

export type CreateRoleFormData = {
  name: string
  description: string
  isActive: boolean
}

type CreateRoleModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateRoleFormData) => void
}

export default function CreateRoleModal({ isOpen, onClose, onSave }: CreateRoleModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [nameError, setNameError] = useState('')

  if (!isOpen) return null

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('Role name is required.')
      return
    }
    if (name.length > 100) {
      setNameError('Role name must be 100 characters or fewer.')
      return
    }

    onSave({ name: name.trim(), description: description.trim(), isActive })
    setName('')
    setDescription('')
    setIsActive(true)
    setNameError('')
    onClose()
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setIsActive(true)
    setNameError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Create Role</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Define a new role for the system.</p>
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
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError('')
              }}
              placeholder="e.g. HR Manager"
              maxLength={100}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                nameError
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-zinc-200 focus:border-zinc-400'
              }`}
            />
            {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this role is for..."
              rows={3}
              maxLength={255}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">{description.length}/255</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-700">Active</p>
              <p className="text-xs text-zinc-500">Inactive roles cannot be assigned to users.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-prominent-purple-700' : 'bg-zinc-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
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
            Create Role
          </button>
        </div>
      </div>
    </div>
  )
}
