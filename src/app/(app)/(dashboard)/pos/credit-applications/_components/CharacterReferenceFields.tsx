'use client'

import { Controller, useFieldArray, type Control, type FieldErrors } from 'react-hook-form'
import { X } from 'lucide-react'
import { PhoneField } from '@/src/components/ui/PhoneField'
import { Select } from '@/src/components/ui/Select'
import type { CreateCreditApplicationFormValues } from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

/** "Up to three to match paper form" (mockup, 2026-09-29). */
const MAX_REFERENCES = 3

/**
 * A dropdown rather than free text (client, 2026-09-30) — the same shape as
 * the related-people rows above it, so the whole block is picked rather than
 * typed.
 *
 * The mockup does not enumerate these, so the list is what a branch
 * actually writes on the paper form. It is deliberately NOT the
 * related-people roles: spouse/father/mother are the applicant's household
 * and are captured there, while a character reference is someone outside it.
 *
 * `relationship` stays free text in the schema and on the API, so the
 * references already recorded with a typed value still load and display —
 * narrowing it to this list would have invalidated them.
 */
const RELATIONSHIP_OPTIONS = [
  { value: 'Sibling', label: 'Sibling' },
  { value: 'Relative', label: 'Relative' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Neighbor', label: 'Neighbor' },
  { value: 'Co-worker', label: 'Co-worker' },
  { value: 'Employer', label: 'Employer' },
  { value: 'Barangay Official', label: 'Barangay Official' },
]

type Props = {
  control: Control<CreateCreditApplicationFormValues>
  errors: FieldErrors<CreateCreditApplicationFormValues>
}

/**
 * Scenario 60 item 27 — "CHARACTER REFERENCES: up to three to match paper
 * form; minimum subject to NIG policy".
 *
 * One row to begin with, added as needed up to three — the same add/remove
 * shape as the Items section, rather than three empty rows presented up
 * front. Most applications will not carry three, and three blank boxes read
 * as three things left undone.
 *
 * Nothing here is required: the mockup defers the minimum to a policy nobody
 * has stated, so requiring a reference would invent a rule. The schema does
 * enforce that a row is all-or-nothing — a name with no number cannot be
 * called, and the backend rejects a row without one.
 */
export function CharacterReferenceFields({ control, errors }: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'references',
  })

  const rowErrors = errors.references as
    | { name?: { message?: string }; mobileNumber?: { message?: string } }[]
    | undefined

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Character References <span className="text-zinc-400">(optional, up to three)</span>
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">Transcribe from the signed paper form.</p>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Reference {index + 1}</span>
            {/* The first row is removable too, once there is more than one —
                and when only one remains it can simply be left blank, since
                empty rows are stripped on submit. */}
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove reference ${index + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr]">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Name</label>
              <Controller
                name={`references.${index}.name` as const}
                control={control}
                render={({ field: f }) => (
                  <input {...f} value={f.value ?? ''} maxLength={255} className={fieldClass} />
                )}
              />
              {rowErrors?.[index]?.name && (
                <p className="mt-1 text-xs text-red-600">{rowErrors[index]?.name?.message}</p>
              )}
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Mobile number</label>
              <Controller
                name={`references.${index}.mobileNumber` as const}
                control={control}
                render={({ field: f }) => (
                  <PhoneField value={f.value ?? ''} onChange={f.onChange} />
                )}
              />
              {rowErrors?.[index]?.mobileNumber && (
                <p className="mt-1 text-xs text-red-600">
                  {rowErrors[index]?.mobileNumber?.message}
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Relationship</label>
              <Controller
                name={`references.${index}.relationship` as const}
                control={control}
                render={({ field: f }) => (
                  <Select
                    value={f.value ?? ''}
                    onChange={f.onChange}
                    options={RELATIONSHIP_OPTIONS}
                    placeholder="How they know the applicant…"
                    compact
                  />
                )}
              />
            </div>
          </div>
        </div>
      ))}

      {fields.length < MAX_REFERENCES && (
        <button
          type="button"
          onClick={() => append({ name: '', relationship: '', mobileNumber: '' })}
          className="text-sm font-medium text-prominent-purple-700 hover:underline"
        >
          + Add another reference
        </button>
      )}
    </div>
  )
}
