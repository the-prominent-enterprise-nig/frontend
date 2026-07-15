'use client'

import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type User } from '@/src/schema/settings/list'
import { updateUser } from '@/src/app/(app)/(dashboard)/settings/_actions/update-user'
import { fetchOrgRelations } from '@/src/app/(app)/(dashboard)/human-resource/employees/_actions/fetch-org-relations'
import type { OrgRelations } from '@/src/app/(app)/(dashboard)/human-resource/employees/_actions/fetch-org-relations'
import { showToast } from '@/src/components/ui/toast'

const MARITAL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated'] as const

const Step1Schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(60),
  lastName: z.string().min(1, 'Last name is required').max(60),
  middleName: z.string().max(60).optional(),
  dateOfBirth: z.string().optional(),
  contactNumber: z.string().optional(),
  maritalStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated']).optional(),
})

const Step2Schema = z.object({
  branchId: z.string().uuid().optional(),
  hireDate: z.string().optional(),
})

const MergedSchema = Step1Schema.merge(Step2Schema)
type FormData = z.infer<typeof MergedSchema>

const STEP_TITLES = ['Personal Info', 'Work & Access']

type Props = {
  user: User
  isOpen: boolean
  onClose: () => void
}

function toDateInput(val: string | null | undefined): string {
  if (!val) return ''
  return val.slice(0, 10)
}

export default function EditUserModal({ user, isOpen, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [orgRelations, setOrgRelations] = useState<OrgRelations>({ branches: [] })

  useEffect(() => {
    if (isOpen) {
      fetchOrgRelations()
        .then(setOrgRelations)
        .catch(() => {})
    }
  }, [isOpen])

  const emp = user.employee

  const {
    control,
    handleSubmit,
    trigger,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(MergedSchema),
    defaultValues: {
      firstName: user.firstName ?? emp?.firstName ?? '',
      lastName: user.lastName ?? emp?.lastName ?? '',
      middleName: emp?.middleName ?? '',
      dateOfBirth: toDateInput(emp?.dateOfBirth),
      contactNumber: emp?.contactNumber ?? '',
      maritalStatus: (emp?.maritalStatus as FormData['maritalStatus']) ?? undefined,
      branchId: emp?.branchId ?? undefined,
      hireDate: toDateInput(emp?.hireDate),
    },
  })

  if (!isOpen) return null

  const handleNext = async () => {
    const valid = await trigger(['firstName', 'lastName'])
    if (valid) setStep(1)
  }

  const onSubmit = async (data: FormData) => {
    const result = await updateUser(user.id, {
      firstName: data.firstName,
      lastName: data.lastName,
      ...(data.middleName !== undefined && { middleName: data.middleName }),
      ...(data.contactNumber ? { contactNumber: data.contactNumber } : {}),
      ...(data.dateOfBirth ? { dateOfBirth: data.dateOfBirth } : {}),
      ...(data.maritalStatus ? { maritalStatus: data.maritalStatus } : {}),
      ...(data.hireDate ? { hireDate: data.hireDate } : {}),
      ...(data.branchId ? { branchId: data.branchId } : {}),
    })

    if (!result.success) {
      showToast({
        title: 'Failed to update user',
        description: result.error ?? 'Please try again.',
        status: 'error',
      })
      return
    }

    showToast({
      title: 'User updated',
      description: `${data.firstName} ${data.lastName}'s profile has been saved.`,
      status: 'success',
    })
    reset()
    setStep(0)
    onClose()
    router.refresh()
  }

  const handleClose = () => {
    reset()
    setStep(0)
    onClose()
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
                    Date of Birth
                  </label>
                  <Controller
                    name="dateOfBirth"
                    control={control}
                    render={({ field }) => (
                      <input {...field} type="date" className={inputClass(!!errors.dateOfBirth)} />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Contact Number
                  </label>
                  <Controller
                    name="contactNumber"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="tel"
                        placeholder="09XXXXXXXXX"
                        className={inputClass()}
                      />
                    )}
                  />
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
              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Hire Date</label>
                  <Controller
                    name="hireDate"
                    control={control}
                    render={({ field }) => (
                      <input {...field} type="date" className={inputClass(!!errors.hireDate)} />
                    )}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                <p className="text-sm font-medium text-zinc-700">
                  Current Roles{' '}
                  <span className="font-normal text-zinc-400">({user.userRoles.length})</span>
                </p>
                {user.userRoles.length === 0 ? (
                  <p className="text-xs text-zinc-500">No roles assigned yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.userRoles.map((ur) => (
                      <span
                        key={ur.id}
                        className="rounded-full bg-prominent-purple-100 px-3 py-1 text-xs font-medium text-prominent-purple-700"
                      >
                        {ur.role.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-zinc-400">
                  To add or remove roles, use <strong className="text-zinc-500">Assign Role</strong>{' '}
                  from the user menu.
                </p>
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
              disabled={isSubmitting || !isDirty}
              onClick={handleSubmit(onSubmit)}
              title={!isDirty ? 'No changes to save' : undefined}
              className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
