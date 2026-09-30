'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, HandCoins, Pencil, Trash2, UserCircle2 } from 'lucide-react'
import { getEmployee } from '../../_actions/get-employee'
import { removeEmployee } from '../../_actions/remove-employee'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { Employee } from '@/src/schema/accounting/employees'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'

function fullName(e: { firstName: string; lastName: string; middleName?: string | null }) {
  return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-PH') : undefined
}

export default function EmployeeDetail({ id, session }: { id: string; session: SessionUser }) {
  const router = useRouter()
  const canEdit = hasPermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_UPDATE)
  const canDelete = hasPermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_DELETE)
  const canViewLoans = hasPermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CASH_LOAN_READ)

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getEmployee(id)
    if (res.success && res.data) {
      setEmployee(res.data)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleRemove = async () => {
    if (!employee) return
    if (!confirm(`Remove ${fullName(employee)} from the Employees list? This can't be undone.`))
      return
    setRemoving(true)
    const res = await removeEmployee(employee.id)
    setRemoving(false)
    if (res.success) {
      router.push('/accounting/employees')
    } else {
      alert(res.message || res.error || 'Failed to remove the employee')
    }
  }

  const menuItems: RowMenuItem[] = employee
    ? [
        ...(canViewLoans
          ? [
              {
                label: 'Cash Loans',
                icon: HandCoins,
                onClick: () =>
                  router.push(`/accounting/employee-cash-loans?employeeId=${employee.id}`),
              },
            ]
          : []),
        ...(canEdit
          ? [
              {
                label: 'Edit',
                icon: Pencil,
                onClick: () => router.push(`/accounting/employees/${employee.id}/edit`),
              },
            ]
          : []),
        ...(canDelete
          ? [{ label: 'Remove', icon: Trash2, onClick: handleRemove, variant: 'danger' as const }]
          : []),
      ]
    : []

  if (loading) {
    return <div className="px-6 py-8 text-sm text-zinc-400 lg:px-10">Loading…</div>
  }
  if (notFound || !employee) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Link
          href="/accounting/employees"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Link>
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Employee not found.
        </div>
      </div>
    )
  }

  const hireDate = fmtDate(employee.hireDate)
  const metaParts = [employee.branch?.name, hireDate ? `Hired ${hireDate}` : undefined].filter(
    (p): p is string => Boolean(p)
  )

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/accounting/employees"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-prominent-purple-50 text-lg font-bold text-prominent-purple-700">
              {(employee.firstName[0] ?? '') + (employee.lastName[0] ?? '')}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
                {fullName(employee)}
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                <span className="font-mono">{employee.employeeCode}</span>
                {metaParts.length > 0 ? ` · ${metaParts.join(' · ')}` : ''}
              </p>
            </div>
          </div>
          {removing ? (
            <span className="text-sm text-zinc-400">Removing…</span>
          ) : (
            <RowActionsMenu items={menuItems} />
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-zinc-700">Contact</h3>
            <dl className="divide-y divide-zinc-100">
              <Row label="Email" value={employee.email} />
              <Row label="Contact Number" value={employee.contactNumber} />
              <Row label="Date of Birth" value={fmtDate(employee.dateOfBirth)} />
              <Row label="Marital Status" value={employee.maritalStatus} />
              {employee.pwdType && <Row label="PWD Type" value={employee.pwdType} />}
              {employee.isStudent && <Row label="Student Employee" value="Yes" />}
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-zinc-700">Employment</h3>
            <dl className="divide-y divide-zinc-100">
              <Row label="Branch" value={employee.branch?.name} emptyLabel="Unassigned" />
              <Row
                label="Manager"
                value={
                  employee.manager
                    ? `${employee.manager.firstName} ${employee.manager.lastName}`
                    : undefined
                }
                emptyLabel="No manager"
              />
              <Row label="Hire Date" value={hireDate} />
            </dl>
          </div>
        </div>

        {/* Ties to the POS buyer flow (PosCustomersService.getOrCreateFromEmployee)
            — an employee has no Customer/AR record until they've actually
            bought something at POS at least once; this just reports that
            state rather than offering a way to create one by hand. */}
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <UserCircle2 className="h-5 w-5 shrink-0 text-zinc-400" />
          {employee.customer ? (
            <p className="text-sm text-zinc-600">
              Buys as customer{' '}
              <Link
                href={`/accounting/customers/${employee.customer.id}`}
                className="font-medium text-prominent-purple-700 hover:underline"
              >
                {employee.customer.name} ({employee.customer.customerCode})
              </Link>
            </p>
          ) : (
            <p className="text-sm text-zinc-500">
              Hasn&apos;t bought anything yet — a customer profile is created automatically the
              first time they buy at POS.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  emptyLabel = 'Not set',
}: {
  label: string
  value?: string | null
  emptyLabel?: string
}) {
  const isEmpty = !value
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={isEmpty ? 'italic text-zinc-300' : 'font-medium text-prominent-purple-900'}>
        {isEmpty ? emptyLabel : value}
      </dd>
    </div>
  )
}
