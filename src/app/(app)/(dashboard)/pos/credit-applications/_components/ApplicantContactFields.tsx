'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import type { CreateCreditApplicationFormValues } from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

type Props = {
  control: Control<CreateCreditApplicationFormValues>
  errors: FieldErrors<CreateCreditApplicationFormValues>
}

// Shown once an applicant is picked in CreateCreditApplicationModal —
// pre-filled from the customer's record and editable; saving persists any
// change back to that same customer via customersApi.update() in the
// modal's submit handler, not as part of the credit application payload.
export function ApplicantContactFields({ control, errors }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Phone</label>
        <Controller
          name="applicantPhone"
          control={control}
          render={({ field }) => (
            <input {...field} value={field.value ?? ''} className={fieldClass} />
          )}
        />
        {errors.applicantPhone && (
          <p className="mt-1 text-xs text-red-600">{errors.applicantPhone.message}</p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Email</label>
        <Controller
          name="applicantEmail"
          control={control}
          render={({ field }) => (
            <input {...field} value={field.value ?? ''} type="email" className={fieldClass} />
          )}
        />
        {errors.applicantEmail && (
          <p className="mt-1 text-xs text-red-600">{errors.applicantEmail.message}</p>
        )}
      </div>
    </div>
  )
}
