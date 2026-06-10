'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { useEmployeeList } from '../../_hooks/useEmployeeList'
import { EmployeeFilters } from './EmployeeFilters'
import { hasPermission } from '@/src/hooks/usePermission'
import { HR_PERMISSIONS } from '@/src/libs/guards/hr-permissions'
import { getStatusColor, getUniqueByKey, formatStatus, getFullName } from '../../_utils'
import {
  EmptyMobileState,
  EmptyTableRow,
  EmployeeTableHeader,
  EmployeeTableRow,
  EmployeeMobileCard,
} from '..'
import { Employee } from '@/src/schema/human-resource/employees/list'
import { useRouter } from 'next/navigation'
import UpdateEmployeeModal from '../employee-form/modal/UpdateEmployeeModal'
import CreateEmployeeModal from '../create-employee/CreateEmployeeModal'
import { type SessionUser } from '@/src/libs/guards/permission'

export default function EmployeeMasterlist({ session }: { session: SessionUser | null }) {
  const router = useRouter()

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const canCreate = hasPermission(session, HR_PERMISSIONS.EMPLOYEES_CREATE)
  const canManageActions =
    hasPermission(session, HR_PERMISSIONS.EMPLOYEES_UPDATE) ||
    hasPermission(session, HR_PERMISSIONS.EMPLOYEES_DELETE)

  // Use the employee list hook
  const {
    employees,
    isLoading,
    isFetching,
    isPlaceholderData,
    error,
    pagination,
    filters,
    setSearch,
    setStatus,
    setDepartment,
    setBranch,
    clearFilters,
    hasActiveFilters,
    goToPage,
    nextPage,
    previousPage,
    getPageNumbers,
    refetch,
  } = useEmployeeList()

  const handleClickEmployee = (employeeId: string) => {
    router.push(`/human-resource/employees/${employeeId}`)
  }

  // Extract unique departments and branches from loaded employees
  const departments = React.useMemo(() => getUniqueByKey(employees, 'department'), [employees])
  const branches = React.useMemo(() => getUniqueByKey(employees, 'branch'), [employees])

  const handleEdit = (employeeId: string) => {
    console.log('Edit clicked for employee:', employeeId)
    setSelectedEmployeeId(employeeId)
  }

  const handleCloseModal = () => {
    console.log('Closing modal')
    setSelectedEmployeeId(null)
  }

  console.log('EmployeeMasterlist render - selectedEmployeeId:', selectedEmployeeId)

  return (
    <div className="w-full h-full bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Employee Masterlist
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Employee</span>
              </button>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-800 font-medium">Failed to load employees</p>
                <p className="text-red-600 text-sm mt-1">
                  Please check your connection and try again.
                </p>
              </div>
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
        <EmployeeFilters
          search={filters.search}
          status={filters.status}
          departmentId={filters.departmentId}
          branchId={filters.branchId}
          departments={departments}
          branches={branches}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onDepartmentChange={setDepartment}
          onBranchChange={setBranch}
          onClearFilters={clearFilters}
          resultCount={pagination.totalItems}
          isLoading={isLoading}
        />

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            // Loading Skeleton
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
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <EmployeeTableHeader showActions={canManageActions} />
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.length === 0 ? (
                      <EmptyTableRow hasActiveFilters={hasActiveFilters} />
                    ) : (
                      employees.map((employee: Employee) => (
                        <EmployeeTableRow
                          key={employee.id}
                          employee={employee}
                          isPlaceholderData={isPlaceholderData}
                          onClick={handleClickEmployee}
                          getFullName={(emp) => getFullName(emp as Employee)}
                          getStatusColor={getStatusColor}
                          formatStatus={formatStatus}
                          showActions={canManageActions}
                          onEdit={handleEdit}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200">
                {employees.length === 0 ? (
                  <EmptyMobileState hasActiveFilters={hasActiveFilters} />
                ) : (
                  employees.map((employee: Employee) => (
                    <EmployeeMobileCard
                      key={employee.id}
                      employee={employee}
                      isPlaceholderData={isPlaceholderData}
                      onClick={handleClickEmployee}
                      getFullName={(emp) => getFullName(emp as Employee)}
                      getStatusColor={getStatusColor}
                      formatStatus={formatStatus}
                      showActions={canManageActions}
                      onEdit={handleEdit}
                    />
                  ))
                )}
              </div>

              {/* Pagination */}
              {pagination.totalItems > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4 lg:mb-0 mb-16">
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
                      <ChevronLeft className="w-5 h-5 text-gray-600 cursor-pointer" />
                    </button>

                    <div className="flex items-center gap-1">
                      {getPageNumbers().map((pageNumber) => (
                        <button
                          key={pageNumber}
                          onClick={() => goToPage(pageNumber)}
                          disabled={isPlaceholderData}
                          className={`min-w-10 h-10 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                            pagination.currentPage === pageNumber
                              ? 'bg-purple-800 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={nextPage}
                      disabled={!pagination.hasNextPage || isPlaceholderData}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600 cursor-pointer" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {canCreate && showCreateModal && (
        <CreateEmployeeModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
      )}

      {/* Update Employee Modal */}
      {selectedEmployeeId && canManageActions && (
        <UpdateEmployeeModal
          employeeId={selectedEmployeeId}
          open={!!selectedEmployeeId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
