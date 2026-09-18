'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  CreateCreditApplicationFormSchema,
  NEW_CO_MAKER_VALUE,
  type CreateCreditApplicationFormValues,
} from '@/src/schema/credit/applications'
import { customersApi } from '@/src/libs/api/crm'
import { useCreateCreditApplication } from '../_hooks/useCreateCreditApplication'
import { ApplicantSearchCombobox } from './ApplicantSearchCombobox'
import { ApplicantContactFields } from './ApplicantContactFields'
import { CoMakerFields } from './CoMakerFields'
import { CreditApplicationItemFields } from './CreditApplicationItemFields'
import { CreditApplicationFinancingFields } from './CreditApplicationFinancingFields'
import { getApplicantCustomer } from '../_actions/search-applicants'

type Props = {
  /** Sent as branchId when set (a branch-locked actor). Left unsent
   * otherwise — the backend defaults to the enterprise's main branch. Not
   * a usage restriction, just which branch the application is recorded
   * against for audit purposes (see CreditApplicationService.create()). */
  sessionBranchId?: string | null
  /** Pre-selects the applicant, skipping the search step — set when this
   * page is reached from a specific customer's CRM profile ("Apply for
   * Credit"), which already knows who's applying. The field stays editable:
   * this is a shortcut, not a lock. */
  initialApplicantCustomerId?: string
  /** What to show in the applicant box for a pre-selected applicant, since
   * the combobox has no search result to take a label from yet. */
  initialApplicantLabel?: string
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function NewCreditApplicationForm({
  sessionBranchId,
  initialApplicantCustomerId,
  initialApplicantLabel,
}: Props) {
  // 2026-09-18 — was a modal rendered inside the queue page; now its own
  // route, so the form owns the submit + navigation rather than being handed
  // an onSubmit/onClose pair by the list.
  const { createApplication, isCreating } = useCreateCreditApplication()
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateCreditApplicationFormValues>({
    resolver: zodResolver(CreateCreditApplicationFormSchema),
    defaultValues: {
      branchId: sessionBranchId ?? undefined,
      applicantCustomerId: initialApplicantCustomerId ?? undefined,
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
    setValue('newCoMakerFirstName', '')
    setValue('newCoMakerLastName', '')
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

  const [serverError, setServerError] = useState<string | undefined>(undefined)
  const [isOrchestrating, setIsOrchestrating] = useState(false)

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
          // CoMaker stores one name column — join the captured first/last.
          name: [data.newCoMakerFirstName, data.newCoMakerLastName]
            .map((v) => (v ?? '').trim())
            .filter(Boolean)
            .join(' '),
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

      // createApplication navigates to the new application's detail page on
      // success (see useCreateCreditApplication) — nothing to close now that
      // this is a route rather than an overlay.
      const result = await createApplication({
        ...data,
        coMakerId: resolvedCoMakerId,
        // Same empty-string-select → undefined normalization as coMakerId
        // above — the backend's @IsUUID() rejects '' outright, and
        // @IsOptional() only skips undefined/null, not an empty string.
        priceUseTypeId: data.priceUseTypeId || undefined,
        financingTermId: data.financingTermId || undefined,
        // '' would otherwise coerce to 0 via the DTO's @Type(() => Number),
        // not "no down payment given".
        downPayment: data.downPayment || undefined,
      })
      if (!result.success) {
        setServerError(result.message)
      }
    } finally {
      setIsOrchestrating(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 lg:px-8">
      <Link
        href="/pos/credit-applications"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to credit applications
      </Link>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">New Credit Application</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Saved as a draft — attach documents and submit for investigation next.
          </p>
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
                    initialLabel={initialApplicantLabel}
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

            <CreditApplicationFinancingFields
              control={control}
              errors={errors}
              branchId={sessionBranchId}
            />

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
            <Link
              href="/pos/credit-applications"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isCreating || isOrchestrating}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {(isCreating || isOrchestrating) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreating || isOrchestrating ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
