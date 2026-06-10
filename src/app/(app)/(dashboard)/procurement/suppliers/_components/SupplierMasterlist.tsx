'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useSupplierList } from '../_hooks/useSupplierList'
import { formatStatus, getOnboardingColor, getStatusColor, getSupplierLine } from '../_utils'
import { SupplierFormDialog } from './SupplierFormDialog'
import { deleteSupplier } from '../_actions/delete-supplier'
import type { Supplier } from '@/src/schema/procurement/suppliers/types'

export default function SupplierMasterlist() {
  const router = useRouter()
  const {
    suppliers,
    isLoading,
    isFetching,
    isPlaceholderData,
    error,
    pagination,
    filters,
    setSearch,
    setStatus,
    setOnboardingStatus,
    clearFilters,
    hasActiveFilters,
    goToPage,
    nextPage,
    previousPage,
    getPageNumbers,
    refetch,
  } = useSupplierList()

  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const handleEdit = (s: Supplier) => {
    setEditingSupplier(s)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditingSupplier(null)
    setFormOpen(true)
  }

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Deactivate "${s.name}"? This is reversible.`)) return
    const result = await deleteSupplier(s.id)
    if (result.success) {
      toast.success('Supplier deactivated')
      refetch()
    } else {
      toast.error(result.error || 'Failed to deactivate supplier')
    }
  }

  return (
    <div className="w-full h-full bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Suppliers</h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage supplier records, payment terms, and compliance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleCreate}
              className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Supplier
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-red-800 font-medium">Failed to load suppliers</p>
              <button
                onClick={() => refetch()}
                className="text-red-600 hover:text-red-800 font-medium text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, contact, tax ID..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blacklisted">Blacklisted</option>
          </select>

          <select
            value={filters.onboardingStatus}
            onChange={(e) => setOnboardingStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
          >
            <option value="all">All onboarding</option>
            <option value="pending">Pending</option>
            <option value="in_review">In review</option>
            <option value="approved">Approved</option>
            <option value="blocked">Blocked</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}

          <div className="text-sm text-gray-500 lg:ml-auto whitespace-nowrap">
            {pagination.totalItems} {pagination.totalItems === 1 ? 'result' : 'results'}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 font-medium">
                {hasActiveFilters ? 'No suppliers match your filters' : 'No suppliers yet'}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {hasActiveFilters
                  ? 'Try adjusting or clearing your filters.'
                  : 'Get started by adding your first supplier.'}
              </p>
              {!hasActiveFilters && (
                <button
                  onClick={handleCreate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Supplier
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Terms
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Onboarding
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {suppliers.map((s) => (
                      <tr
                        key={s.id}
                        className={`hover:bg-gray-50 transition-colors ${isPlaceholderData ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">{s.code}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => router.push(`/procurement/suppliers/${s.id}`)}
                            className="font-medium text-gray-900 hover:text-purple-700 cursor-pointer"
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {getSupplierLine(s as Supplier) || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {s.paymentTerms} <span className="text-gray-400">·</span>{' '}
                          <span className="font-mono text-xs">{s.currency}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md border ${getOnboardingColor(s.onboardingStatus)}`}
                          >
                            {formatStatus(s.onboardingStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md border ${getStatusColor(s.status)}`}
                          >
                            {formatStatus(s.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                          <button
                            onClick={() => handleEdit(s as Supplier)}
                            className="text-purple-600 hover:text-purple-800 font-medium cursor-pointer mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(s as Supplier)}
                            className="text-red-600 hover:text-red-800 font-medium cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination.totalItems > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{pagination.from}</span> to{' '}
                    <span className="font-medium">{pagination.to}</span> of{' '}
                    <span className="font-medium">{pagination.totalItems}</span> results
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={previousPage}
                      disabled={!pagination.hasPreviousPage || isPlaceholderData}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex items-center gap-1">
                      {getPageNumbers().map((n) => (
                        <button
                          key={n}
                          onClick={() => goToPage(n)}
                          disabled={isPlaceholderData}
                          className={`min-w-10 h-10 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                            pagination.currentPage === n
                              ? 'bg-purple-800 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={nextPage}
                      disabled={!pagination.hasNextPage || isPlaceholderData}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editingSupplier}
        onSuccess={() => {
          setFormOpen(false)
          setEditingSupplier(null)
          refetch()
        }}
      />
    </div>
  )
}
