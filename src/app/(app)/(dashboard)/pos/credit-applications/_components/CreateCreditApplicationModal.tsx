'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import {
  CreateCreditApplicationFormSchema,
  NEW_CO_MAKER_VALUE,
  type CreateCreditApplicationFormValues,
} from '@/src/schema/credit/applications'
import type { ApiResponse } from '@/src/libs/api/client'
import { customersApi } from '@/src/libs/api/crm'
import { ApplicantSearchCombobox } from './ApplicantSearchCombobox'
import { ApplicantContactFields } from './ApplicantContactFields'
import { CoMakerFields } from './CoMakerFields'
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
      items: [{ itemId: '' }],
    },
  })

  const applicantCustomerId = watch('applicantCustomerId')

  const applicantQuery = useQuery({
    queryKey: ['credit-application-applicant-detail', applicantCustomerId],
    queryFn: () => getApplicantCustomer(applicantCustomerId),
    enabled: !!applicantCustomerId,
  })
  const coMakers = applicantQuery.data?.data?.coMakers ?? []
  const applicant = applicantQuery.data?.data

  useEffect(() => {
    // Selecting a new applicant invalidates whichever co-maker was picked
    // for the previous one, and any contact edits/new-co-maker draft made
    // for it.
    setValue('coMakerId', '')
    setValue('coMakerContactNumber', '')
    setValue('coMakerEmail', '')
    setValue('newCoMakerName', '')
    setValue('newCoMakerRelationship', '')
    setValue('newCoMakerContactNumber', '')
    setValue('newCoMakerEmail', '')
  }, [applicantCustomerId, setValue])

  useEffect(() => {
    if (!applicant) return
    setValue('applicantPhone', applicant.phone ?? '')
    setValue('applicantEmail', applicant.email ?? '')
    // Only re-run when a *different* customer's data resolves — not on
    // every background refetch of the same customer, which would stomp
    // whatever the user is currently typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant?.id, setValue])

  useEffect(() => {
    if (!isOpen) {
      reset({
        branchId: sessionBranchId ?? undefined,
        items: [{ itemId: '' }],
      })
    }
  }, [isOpen, sessionBranchId, reset])

  const [serverError, setServerError] = useState<string | undefined>(undefined)
  const [isOrchestrating, setIsOrchestrating] = useState(false)

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateCreditApplicationFormValues) {
    setServerError(undefined)
    setIsOrchestrating(true)
    try {
      // Applicant contact: only persisted if actually changed, straight to
      // the customer's real record — independent of whether the credit
      // application below ends up saving successfully.
      if (applicant) {
        const phoneChanged = (data.applicantPhone || '') !== (applicant.phone ?? '')
        const emailChanged = (data.applicantEmail || '') !== (applicant.email ?? '')
        if (phoneChanged || emailChanged) {
          const contactRes = await customersApi.update(data.applicantCustomerId, {
            phone: data.applicantPhone || undefined,
            email: data.applicantEmail || undefined,
          })
          if (!contactRes.success) {
            setServerError(contactRes.error ?? "Failed to update the applicant's contact info")
            return
          }
        }
      }

      // Resolve coMakerId to a real id before the application itself is
      // submitted — either by adding a brand-new co-maker, or by patching
      // the selected existing one's contact info if it changed.
      let resolvedCoMakerId = data.coMakerId || undefined

      if (data.coMakerId === NEW_CO_MAKER_VALUE) {
        const addRes = await customersApi.addCoMaker(data.applicantCustomerId, {
          name: (data.newCoMakerName ?? '').trim(),
          relationship: (data.newCoMakerRelationship ?? '').trim(),
          contactNumber: (data.newCoMakerContactNumber ?? '').trim(),
          email: data.newCoMakerEmail || undefined,
        })
        if (!addRes.success || !addRes.data) {
          setServerError(addRes.error ?? 'Failed to add the new co-maker')
          return
        }
        resolvedCoMakerId = addRes.data.id
      } else if (data.coMakerId) {
        const selected = coMakers.find((cm) => cm.id === data.coMakerId)
        const contactChanged =
          !!selected &&
          ((data.coMakerContactNumber || '') !== selected.contactNumber ||
            (data.coMakerEmail || '') !== (selected.email ?? ''))
        if (contactChanged) {
          const updateRes = await customersApi.updateCoMaker(
            data.applicantCustomerId,
            data.coMakerId,
            {
              contactNumber: data.coMakerContactNumber || undefined,
              email: data.coMakerEmail || undefined,
            }
          )
          if (!updateRes.success) {
            setServerError(updateRes.error ?? "Failed to update the co-maker's contact info")
            return
          }
        }
      }

      const result = await onSubmit({ ...data, coMakerId: resolvedCoMakerId })
      if (result.success) {
        onClose()
      } else {
        setServerError(result.message)
      }
    } finally {
      setIsOrchestrating(false)
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

            {applicantCustomerId && <ApplicantContactFields control={control} errors={errors} />}

            <CoMakerFields
              control={control}
              setValue={setValue}
              errors={errors}
              coMakers={coMakers}
              applicantSelected={!!applicantCustomerId}
              isLoading={applicantQuery.isLoading}
            />

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
              disabled={isSubmitting || isOrchestrating}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isOrchestrating}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {(isSubmitting || isOrchestrating) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting || isOrchestrating ? 'Creating…' : 'Open Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
