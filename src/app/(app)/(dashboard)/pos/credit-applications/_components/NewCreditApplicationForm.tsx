'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import {
  CreateCreditApplicationFormSchema,
  NEW_CO_MAKER_VALUE,
  type CreateCreditApplicationFormValues,
} from '@/src/schema/credit/applications'
import { posCustomersApi } from '@/src/libs/api/pos-customers'
import { useCreateCreditApplication } from '../_hooks/useCreateCreditApplication'
import { ApplicantSearchCombobox } from './ApplicantSearchCombobox'
import { ApplicantContactFields } from './ApplicantContactFields'
import { CoMakerFields } from './CoMakerFields'
import {
  CreditApplicationItemFields,
  type InitialCreditApplicationItem,
} from './CreditApplicationItemFields'
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
  const router = useRouter()
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    getValues,
    reset,
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

  // "+ New customer" leaves this page for the canonical CRM create form
  // and comes back via returnTo. This form's state is plain React state, so
  // — exactly like checkout's cart — it has to be stashed first or a
  // half-filled application is silently lost on the detour. Read-and-delete
  // on the way back, the same shape as the pos_resumed_cart handoff.
  const DRAFT_KEY = 'credit_application_draft'

  // The item combobox shows a label, not an id, and reads its initialLabel
  // only once at mount — so restoring a draft into an already-mounted row
  // left the picker blank even though the itemId was back in form state.
  // Handing the restored rows to CreditApplicationItemFields and changing
  // its key remounts it with the labels in place.
  const [restoredItems, setRestoredItems] = useState<InitialCreditApplicationItem[] | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    localStorage.removeItem(DRAFT_KEY)
    try {
      const draft = JSON.parse(raw) as Partial<CreateCreditApplicationFormValues>
      reset({
        // Defaults first: reset() replaces every value, and checkout seeds
        // only the customer and the installment lines — without this a
        // partial seed would blank branchId, which a full round-trip draft
        // happens to carry but a seed does not.
        branchId: sessionBranchId ?? undefined,
        items: [{ itemId: '' }],
        ...draft,
        // The customer just created wins over whatever the draft had —
        // that's the whole point of the trip.
        applicantCustomerId: initialApplicantCustomerId ?? draft.applicantCustomerId ?? '',
      } as CreateCreditApplicationFormValues)
      const rows = (draft.items ?? [])
        .filter((i) => i.itemId)
        .map((i) => ({
          itemId: i.itemId,
          itemLabel: i.itemLabel ?? '',
          itemMeta: {
            sellingPrice: i.estimatedPrice ?? null,
            modelNumber: null,
          },
        }))
      if (rows.length) setRestoredItems(rows)
    } catch {
      // A corrupt draft shouldn't block the form; fall through to a blank one.
    }
    // Once, on mount, before anything else can touch the fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goToCreateCustomer() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues()))
    router.push('/pos/customers/new?returnTo=/pos/credit-applications/new')
  }

  const applicantQuery = useQuery({
    queryKey: ['credit-application-applicant-detail', applicantCustomerId],
    queryFn: () => getApplicantCustomer(applicantCustomerId),
    enabled: !!applicantCustomerId,
  })
  const coMakers = applicantQuery.data?.data?.coMakers ?? []
  const applicant = applicantQuery.data?.data

  // Skips the first run so restoring a stashed draft (or arriving with a
  // pre-selected applicant) isn't immediately undone by the clear below —
  // that effect is about *changing* applicant, not about initial load.
  const applicantSettled = useRef(false)

  useEffect(() => {
    if (!applicantSettled.current) {
      applicantSettled.current = true
      return
    }
    // Selecting a new applicant invalidates whichever co-maker was picked
    // for the previous one, and any contact edits/new-co-maker draft made
    // for it.
    setValue('coMakerId', '')
    setValue('coMakerFirstName', '')
    setValue('coMakerLastName', '')
    setValue('coMakerRelationship', '')
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
          const contactRes = await posCustomersApi.update(data.applicantCustomerId, {
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
        // CoMaker stores one name column — join the captured first/last.
        const newName = [data.newCoMakerFirstName, data.newCoMakerLastName]
          .map((v) => (v ?? '').trim())
          .filter(Boolean)
          .join(' ')
        const newRelationship = (data.newCoMakerRelationship ?? '').trim()

        // Reuse an identical co-maker instead of adding a second one.
        // addCoMaker commits before the application is created, so if the
        // application then fails validation the co-maker is already on the
        // customer's profile — and every retry used to append another copy,
        // walking towards the hard cap of 5. There is deliberately no
        // rollback: CoMaker has no delete endpoint, and CreditApplication
        // .coMakerId is SET NULL, so deleting one would silently detach it
        // from other applications that reference it.
        const existing = coMakers.find(
          (cm) =>
            cm.name.trim().toLowerCase() === newName.toLowerCase() &&
            cm.relationship.trim().toLowerCase() === newRelationship.toLowerCase()
        )
        if (existing) {
          resolvedCoMakerId = existing.id
        } else {
          const addRes = await posCustomersApi.addCoMaker(data.applicantCustomerId, {
            name: newName,
            relationship: newRelationship,
            contactNumber: (data.newCoMakerContactNumber ?? '').trim(),
            email: data.newCoMakerEmail || undefined,
          })
          if (!addRes.success || !addRes.data) {
            setServerError(addRes.error ?? 'Failed to add the new co-maker')
            return
          }
          resolvedCoMakerId = addRes.data.id
        }
      } else if (data.coMakerId) {
        const selected = coMakers.find((cm) => cm.id === data.coMakerId)
        // The two inputs are rejoined into CoMaker's single `name` column,
        // mirroring how they were split apart when the co-maker was picked.
        const coMakerJoinedName = [data.coMakerFirstName, data.coMakerLastName]
          .map((v) => (v ?? '').trim())
          .filter(Boolean)
          .join(' ')
        // Name and relationship are diffed alongside contact now, so a
        // misspelling captured earlier can be corrected here rather than
        // being stuck on the record forever.
        const changed =
          !!selected &&
          (coMakerJoinedName !== selected.name ||
            (data.coMakerRelationship || '') !== selected.relationship ||
            (data.coMakerContactNumber || '') !== selected.contactNumber ||
            (data.coMakerEmail || '') !== (selected.email ?? ''))
        if (changed) {
          const updateRes = await posCustomersApi.updateCoMaker(
            data.applicantCustomerId,
            data.coMakerId,
            {
              name: coMakerJoinedName || undefined,
              relationship: data.coMakerRelationship || undefined,
              contactNumber: data.coMakerContactNumber || undefined,
              email: data.coMakerEmail || undefined,
            }
          )
          if (!updateRes.success) {
            setServerError(updateRes.error ?? 'Failed to update the co-maker')
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
        // Form-only: it exists so the schema can check the down-payment
        // floor against the resolved total. The DTO whitelist would drop it
        // anyway, but sending a field the API never declares is noise.
        resolvedItemTotal: undefined,
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
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-medium text-zinc-700">
                  Applicant <span className="text-red-500">*</span>
                </label>
                {/* A walk-in with no profile can't be searched for. Sends
                    the cashier to the CRM create form and back, rather than
                    adding a second place customers get created. */}
                <button
                  type="button"
                  onClick={goToCreateCustomer}
                  className="flex items-center gap-1 text-xs font-medium text-prominent-purple-700 hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  New customer
                </button>
              </div>
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

            <CreditApplicationItemFields
              key={restoredItems ? 'restored' : 'fresh'}
              control={control}
              setValue={setValue}
              errors={errors}
              initialItems={restoredItems ?? undefined}
            />

            <CreditApplicationFinancingFields
              control={control}
              setValue={setValue}
              trigger={trigger}
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
