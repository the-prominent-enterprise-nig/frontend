'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { CharacterReferenceFields } from './CharacterReferenceFields'
import { RelatedPeopleFields } from './RelatedPeopleFields'
import { PaperRecordFields } from './PaperRecordFields'
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
      // One row to start; more are added as needed, up to three. Three empty
      // boxes up front read as three things left undone, and most
      // applications will not carry three. An untouched row is stripped on
      // submit, so the default costs nothing.
      references: [{ name: '', relationship: '', mobileNumber: '' }],
      // Same reasoning as the references above — one row, role picked per
      // row, added as needed up to three.
      relatedPeople: [{ role: '', firstName: '', lastName: '', mobileNumber: '' }],
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
        references: [{ name: '', relationship: '', mobileNumber: '' }],
        relatedPeople: [{ role: '', firstName: '', lastName: '', mobileNumber: '' }],
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

  const queryClient = useQueryClient()
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
    // Scenario 60 item 27 — "prefill for returning customers, then confirm
    // or edit". These all came back on this same query long before they were
    // rendered; seeding them is what makes the block a confirmation step
    // rather than a second data-entry form.
    setValue('applicantFirstName', applicant.firstName ?? '')
    setValue('applicantMiddleName', applicant.middleName ?? '')
    setValue('applicantLastName', applicant.lastName ?? '')
    setValue('applicantAltPhone', applicant.altPhone ?? '')
    setValue('applicantBirthday', applicant.birthday ? applicant.birthday.slice(0, 10) : '')
    setValue('applicantCivilStatus', applicant.civilStatus ?? '')
    setValue('applicantGender', applicant.gender ?? '')
    setValue('applicantFacebookName', applicant.facebookName ?? '')
    setValue('applicantEmployer', applicant.companyName ?? '')
    setValue('applicantCustomerType', applicant.customerType ?? '')
    setValue('applicantAddress', applicant.address ?? '')
    setValue('applicantBarangayCode', applicant.barangayCode ?? '')
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
        // Scenario 60 item 27 — the whole CUSTOMER PROFILE block is diffed,
        // not just phone and email. Each entry is [what the form holds, what
        // the customer record holds]; only a genuine change is sent, so an
        // application raised without touching the block issues no PATCH at
        // all.
        const profileDiff: [keyof typeof profilePatch, string, string][] = [
          ['phone', data.applicantPhone || '', applicant.phone ?? ''],
          ['email', data.applicantEmail || '', applicant.email ?? ''],
          ['firstName', data.applicantFirstName || '', applicant.firstName ?? ''],
          ['middleName', data.applicantMiddleName || '', applicant.middleName ?? ''],
          ['lastName', data.applicantLastName || '', applicant.lastName ?? ''],
          ['altPhone', data.applicantAltPhone || '', applicant.altPhone ?? ''],
          [
            'birthday',
            data.applicantBirthday || '',
            applicant.birthday ? applicant.birthday.slice(0, 10) : '',
          ],
          ['civilStatus', data.applicantCivilStatus || '', applicant.civilStatus ?? ''],
          ['gender', data.applicantGender || '', applicant.gender ?? ''],
          ['facebookName', data.applicantFacebookName || '', applicant.facebookName ?? ''],
          ['companyName', data.applicantEmployer || '', applicant.companyName ?? ''],
          ['customerType', data.applicantCustomerType || '', applicant.customerType ?? ''],
          ['address', data.applicantAddress || '', applicant.address ?? ''],
          ['barangayCode', data.applicantBarangayCode || '', applicant.barangayCode ?? ''],
        ]
        const profilePatch: Record<string, unknown> = {}
        for (const [key, next, current] of profileDiff) {
          if (next !== current) profilePatch[key] = next || undefined
        }

        if (Object.keys(profilePatch).length > 0) {
          // `name` is the single display column every other screen reads, so
          // it has to be rebuilt whenever a name part changes — leaving it
          // stale would have the customer listed under their old name while
          // the application showed the new one.
          if (
            'firstName' in profilePatch ||
            'middleName' in profilePatch ||
            'lastName' in profilePatch
          ) {
            profilePatch.name =
              [data.applicantFirstName, data.applicantLastName]
                .map((v) => (v ?? '').trim())
                .filter(Boolean)
                .join(' ') || applicant.name
          }
          // Birthday is a Date on the API, a 'YYYY-MM-DD' string in the form.
          if (typeof profilePatch.birthday === 'string') {
            profilePatch.birthday = new Date(profilePatch.birthday)
          }

          const contactRes = await posCustomersApi.update(
            data.applicantCustomerId,
            profilePatch as Parameters<typeof posCustomersApi.update>[1]
          )
          if (!contactRes.success) {
            setServerError(contactRes.error ?? "Failed to update the applicant's profile")
            return
          }
          // The diff above reads this query's cache, so without refreshing it
          // a retry would re-send an identical patch — same reason the
          // co-maker paths below invalidate.
          await queryClient.invalidateQueries({
            queryKey: ['credit-application-applicant-detail', data.applicantCustomerId],
          })
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
          // The dedupe above reads `coMakers` out of this query's cache, so
          // without refreshing it a retry cannot see what this call just
          // created and adds another copy — which is how a customer reached
          // the hard cap of 5 identical co-makers in testing (2026-09-28).
          // The cap then withholds "Add a new co-maker" entirely, so the
          // form becomes unusable for that applicant.
          await queryClient.invalidateQueries({
            queryKey: ['credit-application-applicant-detail', data.applicantCustomerId],
          })
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
          // Same reason: the `changed` diff above compares against cached
          // values, which would otherwise re-send an identical update on
          // every retry.
          await queryClient.invalidateQueries({
            queryKey: ['credit-application-applicant-detail', data.applicantCustomerId],
          })
        }
      }

      // createApplication navigates to the new application's detail page on
      // success (see useCreateCreditApplication) — nothing to close now that
      // this is a route rather than an overlay.
      const result = await createApplication({
        ...data,
        coMakerId: resolvedCoMakerId,
        // createCreditApplication re-validates this payload against the very
        // same schema, and by here coMakerId is a real id even when the user
        // filled the NEW co-maker fields. That makes the schema take its
        // "existing co-maker" branch, which requires coMakerContactNumber —
        // a field this flow never populates. The number lives in
        // newCoMakerContactNumber, so carry it across and send a coherent
        // payload rather than one that describes an existing co-maker while
        // omitting its number. (Scenario 60 Part 4 added that rule; before
        // it, this mismatch was harmless and so went unnoticed — the
        // co-maker was created and the application then failed validation.)
        coMakerContactNumber:
          data.coMakerId === NEW_CO_MAKER_VALUE
            ? data.newCoMakerContactNumber
            : data.coMakerContactNumber,
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
        downPaymentFloor: undefined,
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

            {applicantCustomerId && (
              <ApplicantContactFields
                control={control}
                errors={errors}
                customerType={watch('applicantCustomerType')}
              />
            )}

            <CoMakerFields
              control={control}
              setValue={setValue}
              errors={errors}
              coMakers={coMakers}
              applicantSelected={!!applicantCustomerId}
              isLoading={applicantQuery.isLoading}
            />

            <RelatedPeopleFields control={control} errors={errors} />

            <CharacterReferenceFields control={control} errors={errors} />

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
              required
            />

            <PaperRecordFields control={control} errors={errors} />

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
