'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CategorySelect from '@/src/components/ui/CategorySelect'
import EmployeePicker from '@/src/components/accounting/EmployeePicker'
import { BranchesApi, type BranchLite } from '@/src/libs/data/OrgStructureData'
import { getEmployee } from '../_actions/get-employee'
import { createEmployee } from '../_actions/create-employee'
import { updateEmployee } from '../_actions/update-employee'
import {
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYEE_MARITAL_STATUS_OPTIONS,
} from '@/src/schema/accounting/employees'

type FormState = {
  employeeCode: string
  firstName: string
  middleName: string
  lastName: string
  email: string
  contactNumber: string
  dateOfBirth: string
  hireDate: string
  status: string
  maritalStatus: string
  pwdType: string
  isStudent: boolean
  branchId: string
  managerId: string
}

const empty: FormState = {
  employeeCode: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  contactNumber: '',
  dateOfBirth: '',
  hireDate: '',
  status: 'active',
  maritalStatus: 'Single',
  pwdType: '',
  isStudent: false,
  branchId: '',
  managerId: '',
}

/** Shared by both /accounting/employees/new and /accounting/employees/[id]/edit
 * — a single `id` prop switches CREATE vs EDIT, same convention as CRM's
 * CustomerForm: self-fetches the existing record rather than the caller
 * pre-loading it. */
export default function EmployeeForm({ id }: { id?: string }) {
  const isEdit = Boolean(id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(empty)
  const [managerLabel, setManagerLabel] = useState('')
  const [branches, setBranches] = useState<BranchLite[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    BranchesApi.list().then((r) => setBranches(r.data?.data ?? []))
  }, [])

  useEffect(() => {
    if (!id) return
    getEmployee(id).then((res) => {
      if (res.success && res.data) {
        const e = res.data
        setForm({
          employeeCode: e.employeeCode,
          firstName: e.firstName,
          middleName: e.middleName ?? '',
          lastName: e.lastName,
          email: e.email ?? '',
          contactNumber: e.contactNumber ?? '',
          dateOfBirth: e.dateOfBirth ? e.dateOfBirth.slice(0, 10) : '',
          hireDate: e.hireDate ? e.hireDate.slice(0, 10) : '',
          status: e.status,
          maritalStatus: e.maritalStatus,
          pwdType: e.pwdType ?? '',
          isStudent: e.isStudent,
          branchId: e.branchId ?? '',
          managerId: e.managerId ?? '',
        })
        setManagerLabel(e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '')
      } else {
        setNotFound(true)
      }
      setLoading(false)
    })
  }, [id])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const branchOptions = branches.map((b) => ({ id: b.id, name: b.name, depth: 0 }))
  const detailHref = id ? `/accounting/employees/${id}` : '/accounting/employees'

  const validate = (): string | null => {
    if (!form.firstName.trim()) return 'First name is required.'
    if (!form.lastName.trim()) return 'Last name is required.'
    if (id && form.managerId === id) return 'An employee cannot be their own manager.'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      employeeCode: form.employeeCode.trim() || undefined,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      middleName: form.middleName.trim() || undefined,
      email: form.email.trim() || undefined,
      contactNumber: form.contactNumber.trim() || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      hireDate: form.hireDate || undefined,
      status: form.status as (typeof EMPLOYEE_STATUS_OPTIONS)[number],
      maritalStatus: form.maritalStatus as (typeof EMPLOYEE_MARITAL_STATUS_OPTIONS)[number],
      pwdType: form.pwdType.trim() || undefined,
      isStudent: form.isStudent,
      branchId: form.branchId || undefined,
      managerId: form.managerId || undefined,
    }

    const res = id ? await updateEmployee(id, payload) : await createEmployee(payload)

    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || `Failed to ${isEdit ? 'update' : 'add'} the employee`)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['accounting-employees'] })
    router.push(`/accounting/employees/${res.data.id}`)
  }

  if (loading) {
    return <div className="px-6 py-8 text-sm text-zinc-400 lg:px-10">Loading…</div>
  }
  if (isEdit && notFound) {
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

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href={detailHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {isEdit ? 'Back to Employee' : 'Back to Employees'}
        </Link>

        <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
          {isEdit ? 'Edit Employee' : 'Add Employee'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          The Employees master list — used to pick a borrower/payee and to create a linked customer.
        </p>

        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="First Name *">
              <input
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Middle Name">
              <input
                value={form.middleName}
                onChange={(e) => setField('middleName', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Last Name *">
              <input
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Employee Code">
            <input
              value={form.employeeCode}
              onChange={(e) => setField('employeeCode', e.target.value)}
              placeholder="Auto-generated if left blank"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Contact Number">
              <input
                value={form.contactNumber}
                onChange={(e) => setField('contactNumber', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date of Birth">
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField('dateOfBirth', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Hire Date">
              <input
                type="date"
                value={form.hireDate}
                onChange={(e) => setField('hireDate', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                {EMPLOYEE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marital Status">
              <select
                value={form.maritalStatus}
                onChange={(e) => setField('maritalStatus', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                {EMPLOYEE_MARITAL_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Branch">
            <CategorySelect
              aria-label="Select branch"
              noun="branches"
              value={form.branchId}
              onChange={(id) => setField('branchId', id ?? '')}
              options={branchOptions}
              placeholder="— Unassigned —"
            />
          </Field>

          <Field label="Manager">
            <EmployeePicker
              value={form.managerId}
              selectedLabel={managerLabel}
              onChange={(id, label) => {
                setField('managerId', id)
                setManagerLabel(label)
              }}
            />
          </Field>

          <Field label="PWD Type">
            <input
              value={form.pwdType}
              onChange={(e) => setField('pwdType', e.target.value)}
              placeholder="Leave blank if not applicable"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.isStudent}
              onChange={(e) => setField('isStudent', e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Student employee
          </label>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
            <Link
              href={detailHref}
              className="rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  )
}
