'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { PhoneField } from '@/src/components/ui/PhoneField'
import { Select } from '@/src/components/ui/Select'
import PhilippineAddressPicker from '@/src/components/common/PhilippineAddressPicker'
import { CIVIL_STATUS_OPTIONS } from '@/src/schema/crm/customer'
import { CUSTOMER_TYPE_LABELS } from '@/src/schema/crm/types'
import type { CreateCreditApplicationFormValues } from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'
const labelClass = 'mb-1 block text-xs font-medium text-zinc-600'

const CIVIL_STATUS_SELECT = CIVIL_STATUS_OPTIONS.map((c) => ({ value: c, label: c }))
const GENDER_SELECT = [
  { value: 'M', label: 'M' },
  { value: 'F', label: 'F' },
]
const CUSTOMER_TYPE_SELECT = (
  Object.keys(CUSTOMER_TYPE_LABELS) as (keyof typeof CUSTOMER_TYPE_LABELS)[]
).map((t) => ({ value: t, label: CUSTOMER_TYPE_LABELS[t] }))

type Props = {
  control: Control<CreateCreditApplicationFormValues>
  errors: FieldErrors<CreateCreditApplicationFormValues>
  /** Labels the Employer box the way the customer's type reads it — a
   *  business has a company name, a self-employed applicant has their own
   *  business. One column, three names; see the Customer type. */
  customerType?: string
}

/**
 * Scenario 60 item 27 — the mockup's CUSTOMER PROFILE block, shown once an
 * applicant is picked.
 *
 * "Prefill for returning customers, then confirm or edit": every box here is
 * seeded from the customer's own record and writes back to it on submit (see
 * NewCreditApplicationForm's handleFormSubmit), not into the credit
 * application. The application stores an applicantCustomerId; the profile is
 * the customer's.
 *
 * It was phone and email only until 2026-09-30. The other ten fields existed
 * on the customer and came back on the very same API call this page already
 * made — they were simply never rendered, so a cashier could not confirm or
 * fix any of them while the applicant was in front of them, which is the one
 * moment the information is checkable.
 *
 * Nothing here is required. The mockup marks none of it so, and a returning
 * customer captured before these fields existed has none of them on file —
 * making any of them mandatory would block an application over a blank the
 * applicant may not be able to fill.
 */
export function ApplicantContactFields({ control, errors, customerType }: Props) {
  const employerLabel =
    customerType === 'business'
      ? 'Company name'
      : customerType === 'self_employed'
        ? 'Business name'
        : 'Employer'

  return (
    <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Customer Profile</label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Prefilled from the customer&apos;s record. Confirm or correct it while the applicant is
          here — changes save back to their record, not to this application.
        </p>
      </div>

      {/*
       * One 12-column grid for the whole block, with each field taking a
       * span, rather than a fresh 3-column grid per row. The rows had
       * drifted into different track widths, so no two field edges lined up
       * down the block and a label that wrapped to two lines pushed its own
       * row's inputs out of step with its neighbours.
       *
       * Grouped the way the counter asks them: who they are, how to reach
       * them, where they are online, how they earn, where they live.
       */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-12">
        <div className="col-span-1 min-w-0 sm:col-span-5">
          <label className={labelClass}>Last name</label>
          <Controller
            name="applicantLastName"
            control={control}
            render={({ field }) => (
              <input {...field} value={field.value ?? ''} maxLength={150} className={fieldClass} />
            )}
          />
        </div>
        <div className="col-span-1 min-w-0 sm:col-span-5">
          <label className={labelClass}>First name</label>
          <Controller
            name="applicantFirstName"
            control={control}
            render={({ field }) => (
              <input {...field} value={field.value ?? ''} maxLength={150} className={fieldClass} />
            )}
          />
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-2">
          {/* "Middle initial" on the paper form, but the column holds a full
              middle name and other screens show it in full — so the field
              accepts either rather than truncating what is already stored. */}
          <label className={labelClass}>M.I.</label>
          <Controller
            name="applicantMiddleName"
            control={control}
            render={({ field }) => (
              <input {...field} value={field.value ?? ''} maxLength={150} className={fieldClass} />
            )}
          />
        </div>

        <div className="col-span-1 min-w-0 sm:col-span-4">
          <label className={labelClass}>Main mobile</label>
          <Controller
            name="applicantPhone"
            control={control}
            render={({ field }) => (
              <PhoneField value={field.value ?? ''} onChange={field.onChange} />
            )}
          />
          {errors.applicantPhone && (
            <p className="mt-1 text-xs text-red-600">{errors.applicantPhone.message}</p>
          )}
        </div>
        <div className="col-span-1 min-w-0 sm:col-span-4">
          <label className={labelClass}>
            Alt mobile <span className="text-zinc-400">(optional)</span>
          </label>
          <Controller
            name="applicantAltPhone"
            control={control}
            render={({ field }) => (
              <PhoneField value={field.value ?? ''} onChange={field.onChange} />
            )}
          />
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-4">
          <label className={labelClass}>Birthdate</label>
          <Controller
            name="applicantBirthday"
            control={control}
            render={({ field }) => (
              <input {...field} value={field.value ?? ''} type="date" className={fieldClass} />
            )}
          />
        </div>

        {/* Email and Facebook share a row: both are long free text, both are
            optional, and the mockup asks for them the same way — "enter
            address or None", "enter name or None". */}
        <div className="col-span-2 min-w-0 sm:col-span-6">
          <label className={labelClass}>
            Email <span className="text-zinc-400">(optional)</span>
          </label>
          <Controller
            name="applicantEmail"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="email"
                placeholder="or None"
                className={fieldClass}
              />
            )}
          />
          {errors.applicantEmail && (
            <p className="mt-1 text-xs text-red-600">{errors.applicantEmail.message}</p>
          )}
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-6">
          <label className={labelClass}>
            Facebook / Messenger <span className="text-zinc-400">(optional)</span>
          </label>
          <Controller
            name="applicantFacebookName"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                maxLength={255}
                placeholder="or None"
                className={fieldClass}
              />
            )}
          />
        </div>

        <div className="col-span-1 min-w-0 sm:col-span-3">
          <label className={labelClass}>Civil status</label>
          <Controller
            name="applicantCivilStatus"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onChange={field.onChange}
                options={CIVIL_STATUS_SELECT}
                placeholder="Select"
              />
            )}
          />
        </div>
        <div className="col-span-1 min-w-0 sm:col-span-2">
          <label className={labelClass}>Gender</label>
          <Controller
            name="applicantGender"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onChange={field.onChange}
                options={GENDER_SELECT}
                placeholder="—"
              />
            )}
          />
        </div>
        <div className="col-span-1 min-w-0 sm:col-span-3">
          {/* Self-employed is answered here, in the type — it stopped being a
              separate Yes/No on 2026-09-30 so the record cannot hold two
              answers to how the applicant earns. */}
          <label className={labelClass}>Employment</label>
          <Controller
            name="applicantCustomerType"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onChange={field.onChange}
                options={CUSTOMER_TYPE_SELECT}
                placeholder="Select"
              />
            )}
          />
        </div>
        <div className="col-span-1 min-w-0 sm:col-span-4">
          <label className={labelClass}>{employerLabel}</label>
          <Controller
            name="applicantEmployer"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                maxLength={255}
                placeholder="if employed"
                className={fieldClass}
              />
            )}
          />
        </div>
      </div>

      {/* Its own panel: the picker brings four dropdowns, a street line and a
          status message of its own, so inline it read as a second form
          leaking into this one rather than as one field called Address. */}
      <div className="rounded-lg border border-zinc-100 bg-white p-3">
        <label className={labelClass}>Address</label>
        {/* Street/sitio/purok line plus Barangay, City/Municipality and
            Province as their own dropdowns. Stored as `address` + the
            barangay's PSGC code, which is what the city and province are
            resolved from — one code rather than three free-text columns that
            can disagree about which city a barangay is in. */}
        <Controller
          name="applicantBarangayCode"
          control={control}
          render={({ field: barangayField }) => (
            <Controller
              name="applicantAddress"
              control={control}
              render={({ field: addressField }) => (
                <PhilippineAddressPicker
                  onChange={(v) => {
                    addressField.onChange(v.address)
                    barangayField.onChange(v.barangayCode)
                  }}
                  initialAddress={addressField.value || undefined}
                  initialBarangayCode={barangayField.value || undefined}
                />
              )}
            />
          )}
        />
      </div>
    </div>
  )
}
