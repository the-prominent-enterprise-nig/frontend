'use client'

import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form'
import { X } from 'lucide-react'
import { PhoneField } from '@/src/components/ui/PhoneField'
import { Select } from '@/src/components/ui/Select'
import type {
  CreateCreditApplicationFormValues,
  CreditApplicationCoMakerLite,
} from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

/**
 * The four people the mockup's RELATED PEOPLE block names. Co-maker joined
 * them on 2026-09-30 (client): it is a row in this list, not a section of its
 * own, exactly as the sheet draws it.
 */
const ROLE_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'co_maker', label: 'Co-maker' },
]

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((o) => [o.value, o.label])
)

/** Three rows, though there are four roles to pick from — any three of
 *  spouse, father, mother and co-maker. Deliberately not tied to
 *  ROLE_OPTIONS.length: the cap is what the form asks for, not how many
 *  kinds of person exist. */
const MAX_RELATED_PEOPLE = 3

/**
 * How a co-maker relates to the applicant — the same list the dedicated
 * co-maker section used before it was folded into this one, so nothing a
 * branch could pick before has been taken away.
 *
 * Spouse is included. It is not a duplicate of the Spouse row: that row says
 * who the applicant is married to, while this says the person guaranteeing
 * the loan happens to be them — a different claim, and the old dedicated
 * section stored exactly that distinction ("Spouse" vs "Co-maker — Parent").
 * A spouse who co-signs is not the same instrument as a third-party
 * guarantee, so the row stays a co-maker rather than turning into a spouse
 * row, which would drop the guarantor link the checkout gate and promissory
 * notes hang off.
 *
 * `CoMaker.relationship` is free text on the API, so values already stored
 * outside this list still load and display.
 */
const CO_MAKER_RELATIONS = [
  'Spouse',
  'Parent',
  'Sibling',
  'Child',
  'Relative',
  'Friend',
  'Other',
] as const

const CO_MAKER_RELATION_OPTIONS = CO_MAKER_RELATIONS.map((r) => ({ value: r, label: r }))

/**
 * Reads a stored `CoMaker.relationship` back into one of the options above.
 *
 * The dedicated co-maker section used to store the role alongside the
 * relation — "Co-maker — Parent" — because a spouse co-signing and a
 * third-party guarantee were the same column. The role is the row's own field
 * now, so only the relation is stored, but records written under the old
 * convention are still on customers and would otherwise land in a dropdown
 * that has no such option and silently show blank.
 *
 * Anything still unrecognised returns null, and the field is left for the
 * user to answer rather than guessed at.
 */
export function parseCoMakerRelation(stored: string): (typeof CO_MAKER_RELATIONS)[number] | null {
  const relation = stored.split('—').pop()?.trim() ?? ''
  return CO_MAKER_RELATIONS.find((r) => r.toLowerCase() === relation.toLowerCase()) ?? null
}

/** Whether two co-maker relations mean the same thing, the old
 *  "Co-maker — Parent" convention included. Anything unrecognised is
 *  compared as written. */
export function sameCoMakerRelation(a: string, b: string): boolean {
  const normalise = (v: string) => (parseCoMakerRelation(v) ?? v.trim()).toLowerCase()
  return normalise(a) === normalise(b)
}

type RowError = {
  role?: { message?: string }
  firstName?: { message?: string }
  mobileNumber?: { message?: string }
  relationship?: { message?: string }
}

type Props = {
  control: Control<CreateCreditApplicationFormValues>
  setValue: UseFormSetValue<CreateCreditApplicationFormValues>
  errors: FieldErrors<CreateCreditApplicationFormValues>
  /** Co-makers already on the applicant's customer profile. Shown under a
   *  co-maker row so a branch can see who is already on file — without them
   *  the only way to find out was to type a name and hope it matched. */
  coMakers?: CreditApplicationCoMakerLite[]
}

/**
 * Scenario 64 item 27 — the mockup's RELATED PEOPLE block: "store each person
 * separately with relationship and mobile".
 *
 * One row to start, added as needed up to three, each removable. The role is
 * picked per row and titles the row, so what stands above it is "Co-maker",
 * not "Person 4". Adding a co-maker is adding a row — there is no separate
 * add-a-co-maker section any more (client, 2026-09-30).
 *
 * Every row works identically, whichever role it holds — there is no picker
 * of saved co-makers and no separate add-a-co-maker flow. Picking "Co-maker"
 * from Relationship IS adding one (client, 2026-09-30).
 *
 * Underneath, a co-maker row still writes to the customer's own `CoMaker`
 * record — what promissory notes and the checkout gate reference — while the
 * other three roles are rows on the application itself. Typing a name and
 * relationship that match a co-maker already on file reuses that record
 * rather than creating a second, so reuse survives losing the picker. That
 * split is invisible here on purpose: it is a storage detail, not something
 * a transcriber should have to think about.
 *
 * Every row needs a name and a contact number (client, 2026-09-30). That
 * overrides the paper form's own "Father mobile / unavailable" option, which
 * the first build honoured: a related person is recorded here to be called,
 * and one nobody can reach is not worth the row. A co-maker additionally
 * needs a relationship — the other three roles already are one.
 */
export function RelatedPeopleFields({ control, setValue, errors, coMakers = [] }: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'relatedPeople',
  })

  // Which saved co-makers are already spoken for. In practice only one
  // co-maker row can exist at a time — the role is unique per application —
  // but the row can be removed and added again, and a stashed draft can come
  // back holding one, so the picker filters rather than assuming.
  const rows = useWatch({ control, name: 'relatedPeople' })
  const coMakerPicks = (rows ?? [])
    .map((row, rowIndex) => ({ rowIndex, id: row?.coMakerId }))
    .filter((pick): pick is { rowIndex: number; id: string } => !!pick.id)

  const rowErrors = errors.relatedPeople as RowError[] | undefined

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Related People or Co-maker <span className="text-zinc-400">(optional, up to three)</span>
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Spouse, father, mother and co-maker. Transcribe from the signed paper form — every person
          recorded here needs a contact number.
        </p>
      </div>

      {fields.map((field, index) => (
        <RelatedPersonRow
          key={field.id}
          control={control}
          setValue={setValue}
          coMakers={coMakers}
          coMakerPicks={coMakerPicks}
          index={index}
          removable={fields.length > 1}
          onRemove={() => remove(index)}
          rowError={rowErrors?.[index]}
        />
      ))}

      {fields.length < MAX_RELATED_PEOPLE && (
        <button
          type="button"
          onClick={() =>
            append({ role: '', firstName: '', lastName: '', mobileNumber: '', relationship: '' })
          }
          className="text-sm font-medium text-prominent-purple-700 hover:underline"
        >
          + Add another person
        </button>
      )}
    </div>
  )
}

function RelatedPersonRow({
  control,
  setValue,
  coMakers,
  coMakerPicks,
  index,
  removable,
  onRemove,
  rowError,
}: {
  control: Control<CreateCreditApplicationFormValues>
  setValue: UseFormSetValue<CreateCreditApplicationFormValues>
  coMakers: CreditApplicationCoMakerLite[]
  coMakerPicks: { rowIndex: number; id: string }[]
  index: number
  removable: boolean
  onRemove: () => void
  rowError?: RowError
}) {
  return (
    <Controller
      name={`relatedPeople.${index}.role` as const}
      control={control}
      render={({ field: roleField }) => {
        const role = roleField.value ?? ''
        const isCoMaker = role === 'co_maker'
        // Anyone attached to ANOTHER row drops out of this one's list — but
        // never this row's own pick, or choosing someone would make the
        // picker vanish and there would be no way back to it to change or
        // clear the choice.
        const pickableCoMakers = coMakers.filter(
          (cm) => !coMakerPicks.some((pick) => pick.id === cm.id && pick.rowIndex !== index)
        )
        const pickedCoMakerId = coMakerPicks.find((pick) => pick.rowIndex === index)?.id ?? ''

        return (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              {/* The row is titled by who it holds. "Person 3" told a
                  transcriber nothing; the role is the point of the row, and
                  it is already picked below. */}
              <span className="text-xs font-medium text-zinc-500">
                {ROLE_LABELS[role] ?? `Person ${index + 1}`}
              </span>
              {removable && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${ROLE_LABELS[role] ?? `person ${index + 1}`}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* First and full width: it is the fastest way to fill the
                  whole row, so it belongs where it is read first, and a
                  half-width box could not show a name and a relationship
                  together without truncating one of them.

                  A co-maker is a record on the customer, not on this
                  application, so one added months ago on a different
                  application is still theirs — and without this the only way
                  to find that out was to type a name and hope it matched.
                  Picking one is the same outcome as typing the identical
                  name and relationship, which submit already dedupes to the
                  existing record. */}
              {isCoMaker && pickableCoMakers.length > 0 && (
                <div className="min-w-0 sm:col-span-2">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <label className="block text-xs font-medium text-zinc-600">
                      Co-maker on file
                    </label>
                    {/* Beside the label rather than as an entry in the list:
                        the list is people, and an action sitting among them
                        reads like one more person to choose. Clearing keeps
                        whatever is typed in the row — the fields are then a
                        new co-maker rather than an edit to the one that was
                        picked. */}
                    {pickedCoMakerId && (
                      <button
                        type="button"
                        onClick={() => setValue(`relatedPeople.${index}.coMakerId`, '')}
                        className="text-xs font-medium text-prominent-purple-700 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {/* Bound to the row's own coMakerId so the choice stays
                      visible — it used to reset to the placeholder the moment
                      it was made, which read as though nothing had happened.
                      "Someone else" clears it back to a typed-in co-maker. */}
                  <Select
                    value={pickedCoMakerId}
                    onChange={(id) => {
                      const picked = pickableCoMakers.find((cm) => cm.id === id)
                      if (!picked) return
                      setValue(`relatedPeople.${index}.coMakerId`, id)
                      const [first, ...rest] = picked.name.trim().split(/\s+/)
                      setValue(`relatedPeople.${index}.firstName`, first ?? '')
                      setValue(`relatedPeople.${index}.lastName`, rest.join(' '))
                      setValue(`relatedPeople.${index}.mobileNumber`, picked.contactNumber)
                      const relation = parseCoMakerRelation(picked.relationship)
                      if (relation) {
                        setValue(`relatedPeople.${index}.relationship`, relation)
                      }
                    }}
                    options={pickableCoMakers.map((cm) => ({
                      value: cm.id,
                      label: `${cm.name} — ${cm.relationship}`,
                    }))}
                    placeholder={`${pickableCoMakers.length} on file — pick to fill`}
                  />
                </div>
              )}

              <div className="min-w-0">
                {/* "Role", not "Relationship": this picks which of the paper
                    form's people the row is. It sat beside "Relationship to
                    applicant" under the same word and read as the same
                    question asked twice (PR #199 review). */}
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Role <span className="text-red-500">*</span>
                </label>
                <Select
                  value={role}
                  onChange={roleField.onChange}
                  options={ROLE_OPTIONS}
                  placeholder="Spouse, father, mother or co-maker…"
                  compact
                />
                {rowError?.role && (
                  <p className="mt-1 text-xs text-red-600">{rowError.role.message}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <Controller
                  name={`relatedPeople.${index}.mobileNumber` as const}
                  control={control}
                  render={({ field: f }) => (
                    <PhoneField value={f.value ?? ''} onChange={f.onChange} />
                  )}
                />
                {rowError?.mobileNumber && (
                  <p className="mt-1 text-xs text-red-600">{rowError.mobileNumber.message}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-zinc-600">First name</label>
                <Controller
                  name={`relatedPeople.${index}.firstName` as const}
                  control={control}
                  render={({ field: f }) => (
                    <input {...f} value={f.value ?? ''} maxLength={150} className={fieldClass} />
                  )}
                />
                {rowError?.firstName && (
                  <p className="mt-1 text-xs text-red-600">{rowError.firstName.message}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Last name <span className="text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name={`relatedPeople.${index}.lastName` as const}
                  control={control}
                  render={({ field: f }) => (
                    <input {...f} value={f.value ?? ''} maxLength={150} className={fieldClass} />
                  )}
                />
              </div>

              {/* Co-maker only. The other three roles ARE the relationship —
                  asking how a father relates to the applicant is asking what
                  the row already answered. */}
              {isCoMaker && (
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Relationship to applicant <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name={`relatedPeople.${index}.relationship` as const}
                    control={control}
                    render={({ field: f }) => (
                      <Select
                        value={f.value ?? ''}
                        onChange={f.onChange}
                        options={CO_MAKER_RELATION_OPTIONS}
                        placeholder="Select"
                        compact
                      />
                    )}
                  />
                  {rowError?.relationship && (
                    <p className="mt-1 text-xs text-red-600">{rowError.relationship.message}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      }}
    />
  )
}
