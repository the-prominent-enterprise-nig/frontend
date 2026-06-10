'use client'

import { useState } from 'react'
import { Search, Filter, X, ChevronDown } from 'lucide-react'
import { STATUSES } from '../../_constants'

interface FilterOption {
  id: string
  name: string
}

interface EmployeeFiltersProps {
  // Filter values
  search: string
  status: string
  departmentId: string
  branchId: string

  // Filter options
  departments: FilterOption[]
  branches: FilterOption[]

  // Handlers
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onDepartmentChange: (value: string) => void
  onBranchChange: (value: string) => void
  onClearFilters: () => void

  // UI state
  resultCount?: number
  isLoading?: boolean
}

export function EmployeeFilters({
  search,
  status,
  departmentId,
  branchId,
  departments,
  branches,
  onSearchChange,
  onStatusChange,
  onDepartmentChange,
  onBranchChange,
  onClearFilters,
  resultCount,
  isLoading,
}: EmployeeFiltersProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const hasActiveFilters =
    search !== '' || status !== 'all' || departmentId !== '' || branchId !== ''

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
      <div className="p-4">
        {/* Desktop: Single Row Layout */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-end">
          {/* Search - Takes up more space */}
          <div className="lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Name, email, or code..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
                disabled={isLoading}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-500 cursor-pointer"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Department Filter */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
            <div className="relative">
              <select
                value={departmentId}
                onChange={(e) => onDepartmentChange(e.target.value)}
                disabled={isLoading || departments.length === 0}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-500 cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Branch Filter */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
            <div className="relative">
              <select
                value={branchId}
                onChange={(e) => onBranchChange(e.target.value)}
                disabled={isLoading || branches.length === 0}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-500 cursor-pointer"
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Mobile & Tablet Layout */}
        <div className="lg:hidden">
          {/* Search Bar - Always Visible */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>

          {/* Toggle Filters Button */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
              </span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  {[status !== 'all', departmentId !== '', branchId !== ''].filter(Boolean).length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                showMobileFilters ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Collapsible Filters */}
          {showMobileFilters && (
            <div className="mt-3 space-y-3 pb-1">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => onStatusChange(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-3 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <div className="relative">
                  <select
                    value={departmentId}
                    onChange={(e) => onDepartmentChange(e.target.value)}
                    disabled={isLoading || departments.length === 0}
                    className="w-full pl-3 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
                <div className="relative">
                  <select
                    value={branchId}
                    onChange={(e) => onBranchChange(e.target.value)}
                    disabled={isLoading || branches.length === 0}
                    className="w-full pl-3 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Summary Bar */}
      {hasActiveFilters && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">
              {resultCount !== undefined ? resultCount : '—'}
            </span>
            <span>employee{resultCount !== 1 ? 's' : ''} found</span>
          </div>

          <button
            onClick={onClearFilters}
            className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}
