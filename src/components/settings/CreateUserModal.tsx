'use client'

import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { createEmployee } from '@/src/app/(app)/(dashboard)/human-resource/employees/_actions/create-employee'
import { fetchOrgRelations } from '@/src/app/(app)/(dashboard)/human-resource/employees/_actions/fetch-org-relations'
import type { OrgRelations } from '@/src/app/(app)/(dashboard)/human-resource/employees/_actions/fetch-org-relations'
import { showToast } from '@/src/components/ui/toast'

const MARITAL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated'] as const

function todayIso() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function genEmployeeCode() {
  const ts = Date.now().toString(36).toUpperCase().slice(-6)
  return `EMP-${ts}`
}

const Step1Schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(60, 'Max 60 characters'),
  lastName: z.string().min(1, 'Last name is required').max(60, 'Max 60 characters'),
  middleName: z.string().max(60, 'Max 60 characters').optional(),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Must be a valid email')
    .max(254, 'Max 254 characters'),
  contactNumber: z
    .string()
    .min(1, 'Contact number is required')
    .regex(/^(\+639|09)\d{9}$/, 'Must be a valid PH number (09XXXXXXXXX)'),
  maritalStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated']).optional(),
})

const Step2Schema = z.object({
  employmentType: z.enum(['probationary', 'regular']),
  branchId: z.string().uuid().optional(),
  position: z.string().max(100).optional(),
  hireDate: z.string().min(1, 'Hire date is required'),
  roleIds: z.array(z.string().uuid()).min(1, 'At least one role is required'),
})

const MergedSchema = Step1Schema.merge(Step2Schema)
type FormData = z.infer<typeof MergedSchema>

type CreateUserModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  availableRoles?: Array<{ id: string; name: string; description?: string | null }>
}

const STEP_TITLES = ['Personal Info', 'Work & Access']

export default function CreateUserModal({
  isOpen,
  onClose,
  onSuccess,
  availableRoles = [],
}: CreateUserModalProps) {
  const [step, setStep] = useState(0)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [orgRelations, setOrgRelations] = useState<OrgRelations>({
    branches: [],
  })

  useEffect(() => {
    if (isOpen) {
      fetchOrgRelations()
        .then(setOrgRelations)
        .catch(() => {})
    }
  }, [isOpen])

  const {
    control,
    handleSubmit,
    trigger,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(MergedSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      middleName: '',
      dateOfBirth: '',
      email: '',
      contactNumber: '',
      maritalStatus: undefined,
      employmentType: 'probationary',
      branchId: undefined,
      position: '',
      hireDate: todayIso(),
      roleIds: [],
    },
  })

  if (!isOpen) return null

  const handleNext = async () => {
    const step1Fields: (keyof FormData)[] = [
      'firstName',
      'lastName',
      'dateOfBirth',
      'email',
      'contactNumber',
    ]
    const valid = await trigger(step1Fields)
    if (valid) setStep(1)
  }

  const onSubmit = async (data: FormData) => {
    const result = await createEmployee({
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName || undefined,
      email: data.email,
      contactNumber: data.contactNumber || undefined,
      dateOfBirth: data.dateOfBirth || undefined,
      maritalStatus: data.maritalStatus || undefined,
      hireDate: data.hireDate || undefined,
      branchId: data.branchId || undefined,
      roleIds: data.roleIds,
    })

    if (!result.success) {
      showToast({
        title: 'Failed to create user',
        description: result.message || result.error,
        status: 'error',
      })
      return
    }

    showToast({
      title: 'User created',
      description: `${data.email} has been added with an employee profile.`,
      status: 'success',
    })

    reset()
    setSelectedRoles([])
    setStep(0)
    onClose()
    onSuccess?.()
  }

  const handleClose = () => {
    reset()
    setSelectedRoles([])
    setStep(0)
    onClose()
  }

  const toggleRole = (roleId: string) => {
    const next = selectedRoles.includes(roleId)
      ? selectedRoles.filter((id) => id !== roleId)
      : [...selectedRoles, roleId]
    setSelectedRoles(next)
    setValue('roleIds', next, { shouldValidate: true })
  }

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
      hasError ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-zinc-400'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Step {step + 1} of 2
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-zinc-900">{STEP_TITLES[step]}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-zinc-100">
          <div
            className="h-1 bg-prominent-purple-700 transition-all duration-300"
            style={{ width: step === 0 ? '50%' : '100%' }}
          />
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Step 1: Personal Info ── */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="firstName"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="Juan"
                        maxLength={60}
                        className={inputClass(!!errors.firstName)}
                      />
                    )}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="Dela Cruz"
                        maxLength={60}
                        className={inputClass(!!errors.lastName)}
                      />
                    )}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Middle Name
                  </label>
                  <Controller
                    name="middleName"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="Optional"
                        maxLength={60}
                        className={inputClass()}
                      />
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="dateOfBirth"
                    control={control}
                    render={({ field }) => (
                      <input {...field} type="date" className={inputClass(!!errors.dateOfBirth)} />
                    )}
                  />
                  {errors.dateOfBirth && (
                    <p className="mt-1 text-xs text-red-500">{errors.dateOfBirth.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="email"
                      placeholder="user@example.com"
                      maxLength={254}
                      className={inputClass(!!errors.email)}
                    />
                  )}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="contactNumber"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="tel"
                        placeholder="09XXXXXXXXX"
                        className={inputClass(!!errors.contactNumber)}
                      />
                    )}
                  />
                  {errors.contactNumber && (
                    <p className="mt-1 text-xs text-red-500">{errors.contactNumber.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Marital Status
                  </label>
                  <Controller
                    name="maritalStatus"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                        className={inputClass()}
                      >
                        <option value="">Select</option>
                        {MARITAL_STATUSES.map((ms) => (
                          <option key={ms} value={ms}>
                            {ms}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Work & Access ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Employment type */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Employment Status
                </label>
                <Controller
                  name="employmentType"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-3">
                      {(['probationary', 'regular'] as const).map((type) => (
                        <label
                          key={type}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                            field.value === type
                              ? 'border-prominent-purple-600 bg-prominent-purple-50'
                              : 'border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <input
                            type="radio"
                            value={type}
                            checked={field.value === type}
                            onChange={() => field.onChange(type)}
                            className="h-4 w-4 accent-prominent-purple-700"
                          />
                          <span className="text-sm font-medium capitalize text-zinc-800">
                            {type === 'probationary' ? 'Probationary' : 'Regular'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Branch */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Branch</label>
                  <Controller
                    name="branchId"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                        className={inputClass()}
                      >
                        <option value="">Head Office</option>
                        {orgRelations.branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  <p className="mt-1 text-xs text-zinc-400">No branch = Head Office access</p>
                </div>

                {/* Hire date */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Hire Date <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="hireDate"
                    control={control}
                    render={({ field }) => (
                      <input {...field} type="date" className={inputClass(!!errors.hireDate)} />
                    )}
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700"> Job Title</label>
                <Controller
                  name="position"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. Sales Associate, Branch Manager"
                      className={inputClass()}
                    />
                  )}
                />
              </div>

              {/* Roles */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  System Roles{' '}
                  {selectedRoles.length > 0 && (
                    <span className="font-normal text-zinc-400">
                      ({selectedRoles.length} selected)
                    </span>
                  )}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div
                  className={`max-h-52 space-y-1 overflow-y-auto rounded-xl border p-3 ${
                    errors.roleIds ? 'border-red-400' : 'border-zinc-200'
                  }`}
                >
                  {availableRoles.length === 0 ? (
                    <p className="text-sm text-zinc-500">No roles available.</p>
                  ) : (
                    availableRoles.map((role) => (
                      <label
                        key={role.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition hover:bg-zinc-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role.id)}
                          onChange={() => toggleRole(role.id)}
                          className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-prominent-purple-700"
                        />
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{role.name}</p>
                          {role.description && (
                            <p className="mt-0.5 text-xs text-zinc-500">{role.description}</p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {errors.roleIds && (
                  <p className="mt-1 text-xs text-red-500">{errors.roleIds.message}</p>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
          {step === 0 ? (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {step === 0 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit(onSubmit)}
              className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
