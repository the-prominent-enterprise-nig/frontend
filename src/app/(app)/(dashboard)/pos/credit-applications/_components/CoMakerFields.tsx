'use client'

import { useEffect } from 'react'
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form'
import {
  NEW_CO_MAKER_VALUE,
  type CreateCreditApplicationFormValues,
  type CreditApplicationCoMakerLite,
} from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

type Props = {
  control: Control<CreateCreditApplicationFormValues>
  setValue: UseFormSetValue<CreateCreditApplicationFormValues>
  errors: FieldErrors<CreateCreditApplicationFormValues>
  coMakers: CreditApplicationCoMakerLite[]
  applicantSelected: boolean
  isLoading: boolean
}

// The co-maker <select> plus, depending on what's picked, either the
// selected existing co-maker's editable contact fields or a brand-new
// co-maker's full details — see NEW_CO_MAKER_VALUE in the schema.
export function CoMakerFields({
  control,
  setValue,
  errors,
  coMakers,
  applicantSelected,
  isLoading,
}: Props) {
  const coMakerId = useWatch({ control, name: 'coMakerId' })
  const atCap = coMakers.length >= 5

  useEffect(() => {
    if (!coMakerId || coMakerId === NEW_CO_MAKER_VALUE) return
    const selected = coMakers.find((cm) => cm.id === coMakerId)
    if (selected) {
      setValue('coMakerContactNumber', selected.contactNumber)
      setValue('coMakerEmail', selected.email ?? '')
    }
  }, [coMakerId, coMakers, setValue])

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Co-Maker <span className="text-zinc-400">(optional)</span>
        </label>
        <Controller
          name="coMakerId"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              value={field.value ?? ''}
              disabled={!applicantSelected || isLoading}
              className={`${fieldClass} bg-white disabled:bg-zinc-50 disabled:text-zinc-400`}
            >
              <option value="">
                {!applicantSelected
                  ? 'Select an applicant first…'
                  : isLoading
                    ? 'Loading co-makers…'
                    : coMakers.length === 0
                      ? 'No co-maker on file'
                      : 'No co-maker'}
              </option>
              {coMakers.map((cm) => (
                <option key={cm.id} value={cm.id}>
                  {cm.name} ({cm.relationship})
                </option>
              ))}
              {applicantSelected && !isLoading && (
                <option value={NEW_CO_MAKER_VALUE} disabled={atCap}>
                  + Add a new co-maker{atCap ? ' (maximum of 5 reached)' : ''}
                </option>
              )}
            </select>
          )}
        />
        {errors.coMakerId && (
          <p className="mt-1 text-xs text-red-600">{errors.coMakerId.message}</p>
        )}
      </div>

      {coMakerId && coMakerId !== NEW_CO_MAKER_VALUE && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Co-Maker Phone</label>
            <Controller
              name="coMakerContactNumber"
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} className={fieldClass} />
              )}
            />
            {errors.coMakerContactNumber && (
              <p className="mt-1 text-xs text-red-600">{errors.coMakerContactNumber.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Co-Maker Email</label>
            <Controller
              name="coMakerEmail"
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} type="email" className={fieldClass} />
              )}
            />
            {errors.coMakerEmail && (
              <p className="mt-1 text-xs text-red-600">{errors.coMakerEmail.message}</p>
            )}
          </div>
        </div>
      )}

      {coMakerId === NEW_CO_MAKER_VALUE && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Name <span className="text-red-500">*</span>
            </label>
            <Controller
              name="newCoMakerName"
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} className={fieldClass} />
              )}
            />
            {errors.newCoMakerName && (
              <p className="mt-1 text-xs text-red-600">{errors.newCoMakerName.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Relationship <span className="text-red-500">*</span>
            </label>
            <Controller
              name="newCoMakerRelationship"
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} className={fieldClass} />
              )}
            />
            {errors.newCoMakerRelationship && (
              <p className="mt-1 text-xs text-red-600">{errors.newCoMakerRelationship.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Phone <span className="text-red-500">*</span>
            </label>
            <Controller
              name="newCoMakerContactNumber"
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} className={fieldClass} />
              )}
            />
            {errors.newCoMakerContactNumber && (
              <p className="mt-1 text-xs text-red-600">{errors.newCoMakerContactNumber.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Email</label>
            <Controller
              name="newCoMakerEmail"
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} type="email" className={fieldClass} />
              )}
            />
            {errors.newCoMakerEmail && (
              <p className="mt-1 text-xs text-red-600">{errors.newCoMakerEmail.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
