'use client'

import { useEffect } from 'react'
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form'
import PhoneInput, { parsePhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { Select } from '@/src/components/ui/Select'
import {
  NEW_CO_MAKER_VALUE,
  type CreateCreditApplicationFormValues,
  type CreditApplicationCoMakerLite,
} from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

/**
 * PhoneInput's `value` must be E.164 (leading '+') or undefined, or it logs
 * a console error on every mount. Co-maker numbers were captured as plain
 * local strings ("09170004321") before this form used PhoneInput, so
 * best-effort re-parse them as PH and hand back E.164; undefined otherwise,
 * which renders empty while the underlying form value keeps the raw string.
 * Same helper and reasoning as CustomerForm's own toDisplayPhoneValue.
 */
function toDisplayPhoneValue(raw: string): string | undefined {
  if (!raw) return undefined
  if (raw.startsWith('+')) return raw
  try {
    const parsed = parsePhoneNumber(raw, 'PH')
    return parsed?.isValid() ? parsed.number : undefined
  } catch {
    return undefined
  }
}

type Props = {
  control: Control<CreateCreditApplicationFormValues>
  setValue: UseFormSetValue<CreateCreditApplicationFormValues>
  errors: FieldErrors<CreateCreditApplicationFormValues>
  coMakers: CreditApplicationCoMakerLite[]
  applicantSelected: boolean
  isLoading: boolean
}

// The co-maker dropdown plus, depending on what's picked, either the
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
      // CoMaker has a single `name` column, so split on the first space to
      // fill the two inputs — rejoined with one space on submit. Same
      // fallback CustomerForm uses for records without split name columns.
      const [first, ...rest] = selected.name.trim().split(/\s+/)
      setValue('coMakerFirstName', first ?? '')
      setValue('coMakerLastName', rest.join(' '))
      setValue('coMakerRelationship', selected.relationship)
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
            <Select
              value={field.value ?? ''}
              onChange={field.onChange}
              disabled={!applicantSelected || isLoading}
              placeholder={
                !applicantSelected
                  ? 'Select an applicant first…'
                  : isLoading
                    ? 'Loading co-makers…'
                    : coMakers.length === 0
                      ? 'No co-maker on file'
                      : 'No co-maker'
              }
              options={[
                { value: '', label: 'No co-maker' },
                ...coMakers.map((cm) => ({
                  value: cm.id,
                  label: `${cm.name} (${cm.relationship})`,
                })),
              ]}
              // "Add a new co-maker" is a real action row rather than a
              // sentinel <option>, which is what Select's extraAction slot
              // is for. Withheld at the cap of 5 — a native <option
              // disabled> was silently unselectable with no explanation, so
              // the limit is stated below instead.
              extraAction={
                applicantSelected && !isLoading && !atCap
                  ? {
                      label: 'Add a new co-maker',
                      onClick: () => field.onChange(NEW_CO_MAKER_VALUE),
                    }
                  : undefined
              }
            />
          )}
        />
        {errors.coMakerId && (
          <p className="mt-1 text-xs text-red-600">{errors.coMakerId.message}</p>
        )}
        {applicantSelected && !isLoading && atCap && (
          <p className="mt-1 text-xs text-zinc-500">
            This applicant already has the maximum of 5 co-makers.
          </p>
        )}
      </div>

      {coMakerId && coMakerId !== NEW_CO_MAKER_VALUE && (
        <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          {/* Same field grouping and controls as the CRM create-customer
              form (client request, 2026-09-19): first/last name on their own
              row, then a real PH phone input rather than a bare text box. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                First Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="coMakerFirstName"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    maxLength={120}
                    className={fieldClass}
                  />
                )}
              />
              {errors.coMakerFirstName && (
                <p className="mt-1 text-xs text-red-600">{errors.coMakerFirstName.message}</p>
              )}
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Last Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="coMakerLastName"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    maxLength={120}
                    className={fieldClass}
                  />
                )}
              />
              {errors.coMakerLastName && (
                <p className="mt-1 text-xs text-red-600">{errors.coMakerLastName.message}</p>
              )}
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Relationship <span className="text-red-500">*</span>
              </label>
              <Controller
                name="coMakerRelationship"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    maxLength={100}
                    className={fieldClass}
                  />
                )}
              />
              {errors.coMakerRelationship && (
                <p className="mt-1 text-xs text-red-600">{errors.coMakerRelationship.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Phone <span className="text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="coMakerContactNumber"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={toDisplayPhoneValue(field.value ?? '')}
                    defaultCountry="PH"
                    international
                    countryCallingCodeEditable={false}
                    onChange={(v) => field.onChange(v ?? '')}
                    numberInputProps={{ className: 'phone-input-field' }}
                    className="ph-phone-input"
                  />
                )}
              />
              {errors.coMakerContactNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.coMakerContactNumber.message}</p>
              )}
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Email <span className="text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="coMakerEmail"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    type="email"
                    maxLength={255}
                    className={fieldClass}
                  />
                )}
              />
              {errors.coMakerEmail && (
                <p className="mt-1 text-xs text-red-600">{errors.coMakerEmail.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {coMakerId === NEW_CO_MAKER_VALUE && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              First Name <span className="text-red-500">*</span>
            </label>
            <Controller
              name="newCoMakerFirstName"
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} className={fieldClass} />
              )}
            />
            {errors.newCoMakerFirstName && (
              <p className="mt-1 text-xs text-red-600">{errors.newCoMakerFirstName.message}</p>
            )}
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Last Name <span className="text-red-500">*</span>
            </label>
            <Controller
              name="newCoMakerLastName"
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} className={fieldClass} />
              )}
            />
            {errors.newCoMakerLastName && (
              <p className="mt-1 text-xs text-red-600">{errors.newCoMakerLastName.message}</p>
            )}
          </div>
          <div className="min-w-0">
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
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Phone <span className="text-zinc-400">(optional)</span>
            </label>
            <Controller
              name="newCoMakerContactNumber"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  value={toDisplayPhoneValue(field.value ?? '')}
                  defaultCountry="PH"
                  international
                  countryCallingCodeEditable={false}
                  onChange={(v) => field.onChange(v ?? '')}
                  numberInputProps={{ className: 'phone-input-field' }}
                  className="ph-phone-input"
                />
              )}
            />
            {errors.newCoMakerContactNumber && (
              <p className="mt-1 text-xs text-red-600">{errors.newCoMakerContactNumber.message}</p>
            )}
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Email <span className="text-zinc-400">(optional)</span>
            </label>
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
