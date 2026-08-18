'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import {
  CreateCreditApplicationFormSchema,
  type CreateCreditApplicationFormValues,
} from '@/src/schema/credit/applications'
import type { ApiResponse } from '@/src/libs/api/client'
import { ApplicantSearchCombobox } from './ApplicantSearchCombobox'
import { CreditApplicationItemFields } from './CreditApplicationItemFields'
import { getApplicantCustomer } from '../_actions/search-applicants'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateCreditApplicationFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  /** Sent as branchId when set (a branch-locked actor). Left unsent
   * otherwise — the backend defaults to the enterprise's main branch. Not
   * a usage restriction, just which branch the application is recorded
   * against for audit purposes (see CreditApplicationService.create()). */
  sessionBranchId?: string | null
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function CreateCreditApplicationModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  sessionBranchId,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateCreditApplicationFormValues>({
    resolver: zodResolver(CreateCreditApplicationFormSchema),
    defaultValues: {
      branchId: sessionBranchId ?? undefined,
      items: [{ itemId: '', variantId: undefined }],
    },
  })

  const applicantCustomerId = watch('applicantCustomerId')

  const applicantQuery = useQuery({
    queryKey: ['credit-application-applicant-detail', applicantCustomerId],
    queryFn: () => getApplicantCustomer(applicantCustomerId),
    enabled: !!applicantCustomerId,
  })
  const coMakers = applicantQuery.data?.data?.coMakers ?? []

  useEffect(() => {
    // Selecting a new applicant invalidates whichever co-maker was picked for the previous one
    setValue('coMakerId', '')
  }, [applicantCustomerId, setValue])

  useEffect(() => {
    if (!isOpen) {
      reset({
        branchId: sessionBranchId ?? undefined,
        items: [{ itemId: '', variantId: undefined }],
      })
    }
  }, [isOpen, sessionBranchId, reset])

  const [serverError, setServerError] = useState<string | undefined>(undefined)

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateCreditApplicationFormValues) {
    setServerError(undefined)
    const result = await onSubmit(data)
    if (result.success) {
      onClose()
    } else {
      setServerError(result.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">New Credit Application</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Opens as a draft — attach documents and submit for investigation next.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-5 px-6 py-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Applicant <span className="text-red-500">*</span>
              </label>
              <Controller
                name="applicantCustomerId"
                control={control}
                render={({ field }) => (
                  <ApplicantSearchCombobox
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={errors.applicantCustomerId?.message}
                  />
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Co-Maker <span className="text-red-500">*</span>
              </label>
              <Controller
                name="coMakerId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    disabled={!applicantCustomerId || applicantQuery.isLoading}
                    className={`${fieldClass} bg-white disabled:bg-zinc-50 disabled:text-zinc-400`}
                  >
                    <option value="">
                      {!applicantCustomerId
                        ? 'Select an applicant first…'
                        : applicantQuery.isLoading
                          ? 'Loading co-makers…'
                          : coMakers.length === 0
                            ? 'No co-maker on file'
                            : 'Select co-maker…'}
                    </option>
                    {coMakers.map((cm) => (
                      <option key={cm.id} value={cm.id}>
                        {cm.name} ({cm.relationship})
                      </option>
                    ))}
                  </select>
                )}
              />
              {applicantCustomerId && !applicantQuery.isLoading && coMakers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  This customer has no co-maker on file — add one via their CRM profile first.
                </p>
              )}
              {errors.coMakerId && (
                <p className="mt-1 text-xs text-red-600">{errors.coMakerId.message}</p>
              )}
            </div>

            <CreditApplicationItemFields control={control} setValue={setValue} errors={errors} />

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Notes (optional)
              </label>
              <Controller
                name="itemDescription"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                    placeholder="e.g. with installation, specific color preference"
                    className={fieldClass}
                  />
                )}
              />
            </div>

            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating…' : 'Open Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
