'use client'

import { Plus, RefreshCw, Search } from 'lucide-react'
import { ReactNode } from 'react'

interface ListShellProps {
  title: string
  description?: string
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  onAdd?: () => void
  addLabel?: string
  canAdd?: boolean
  onRefresh?: () => void
  isFetching?: boolean
  filters?: ReactNode
  children: ReactNode
}

export function ListShell({
  title,
  description,
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onAdd,
  addLabel = 'Add',
  canAdd,
  onRefresh,
  isFetching,
  filters,
  children,
}: ListShellProps) {
  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isFetching}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-600 hover:bg-prominent-purple-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
            {canAdd && onAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700"
              >
                <Plus className="h-4 w-4" />
                {addLabel}
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 md:flex-row md:items-center">
          {onSearchChange && (
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
              />
            </div>
          )}
          {filters}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
  className?: string
}

export function Field({ label, required, error, children, className }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ''}`}>
      <span className="font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

const baseInput =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500 disabled:bg-gray-50 disabled:text-gray-500'

export const inputClass = baseInput
export const selectClass = baseInput
export const textareaClass = `${baseInput} min-h-[80px]`
