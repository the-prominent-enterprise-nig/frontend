'use client'

import { Controller, useFieldArray, type Control, type FieldErrors } from 'react-hook-form'
import { X } from 'lucide-react'
import { PhoneField } from '@/src/components/ui/PhoneField'
import { Select } from '@/src/components/ui/Select'
import type { CreateCreditApplicationFormValues } from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

/** Spouse, father, mother — the three the mockup's RELATED PEOPLE block
 *  names, and the three the unique (application, role) index allows. */
const ROLE_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
]

const MAX_RELATED_PEOPLE = ROLE_OPTIONS.length

type Props = {
  control: Control<CreateCreditApplicationFormValues>
  errors: FieldErrors<CreateCreditApplicationFormValues>
}

/**
 * Scenario 60 item 27 — the mockup's RELATED PEOPLE block: "store each
 * person separately with relationship and mobile".
 *
 * Same shape as CharacterReferenceFields, per the client (2026-09-30): one
 * row to start, added as needed up to three, each removable. The role is
 * picked per row rather than three pre-labelled rows — most applications
 * name one or two people, and three fixed rows read as three things left
 * undone.
 *
 * Co-maker is deliberately not one of the roles. It keeps its own section
 * above, backed by the existing CoMaker record that promissory notes and the
 * checkout gate already reference.
 *
 * A row needs a role and a first name; the mobile does not. The paper form
 * offers "Father mobile / unavailable", so a blank number is a recorded
 * answer here — unlike a character reference, where a name nobody can call
 * is not a reference.
 */
export function RelatedPeopleFields({ control, errors }: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'relatedPeople',
  })

  const rowErrors = errors.relatedPeople as
    | { role?: { message?: string }; firstName?: { message?: string } }[]
    | undefined

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Related People <span className="text-zinc-400">(optional, up to three)</span>
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Transcribe from the signed paper form. Leave the mobile blank if the form says
          unavailable.
        </p>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Person {index + 1}</span>
            {/* Removable once there is more than one — a single remaining row
                can just be left blank, since empty rows are stripped on
                submit. Same rule as the references above. */}
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove person ${index + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Relationship</label>
              <Controller
                name={`relatedPeople.${index}.role` as const}
                control={control}
                render={({ field: f }) => (
                  <Select
                    value={f.value ?? ''}
                    onChange={f.onChange}
                    options={ROLE_OPTIONS}
                    placeholder="Spouse, father or mother…"
                    compact
                  />
                )}
              />
              {rowErrors?.[index]?.role && (
                <p className="mt-1 text-xs text-red-600">{rowErrors[index]?.role?.message}</p>
              )}
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Mobile</label>
              <Controller
                name={`relatedPeople.${index}.mobileNumber` as const}
                control={control}
                render={({ field: f }) => (
                  <PhoneField value={f.value ?? ''} onChange={f.onChange} />
                )}
              />
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
              {rowErrors?.[index]?.firstName && (
                <p className="mt-1 text-xs text-red-600">{rowErrors[index]?.firstName?.message}</p>
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
          </div>
        </div>
      ))}

      {fields.length < MAX_RELATED_PEOPLE && (
        <button
          type="button"
          onClick={() => append({ role: '', firstName: '', lastName: '', mobileNumber: '' })}
          className="text-sm font-medium text-prominent-purple-700 hover:underline"
        >
          + Add another person
        </button>
      )}
    </div>
  )
}
