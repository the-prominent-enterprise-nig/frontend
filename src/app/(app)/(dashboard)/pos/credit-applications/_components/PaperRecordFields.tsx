'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { Select } from '@/src/components/ui/Select'
import type { CreateCreditApplicationFormValues } from '@/src/schema/credit/applications'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const DP_COLLECTION = [
  { value: 'online', label: 'Online' },
  { value: 'branch', label: 'Branch' },
  { value: 'delivery', label: 'Delivery' },
]

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

type Props = {
  control: Control<CreateCreditApplicationFormValues>
  errors: FieldErrors<CreateCreditApplicationFormValues>
}

const REQUIRED = <span className="text-red-500">*</span>

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null
}

/**
 * Scenario 60 item 27 — the mockup's PROPOSED PURCHASE AND INSTALLMENT and
 * PAPER RECORD blocks.
 *
 * The mockup marks the purchase block "read only from POS draft, then linked
 * sale". It is typed here instead, because there is no draft or quote entity
 * to read from — a POS draft reference is a free-text field until one exists.
 * The financing figures that ARE derived (amount financed, monthly, total
 * payable) stay in the Price Use & Financing section and are not repeated.
 *
 * LCP is hand-entered and deliberately not wired into any calculation: the
 * mockup states `amount financed = LCP - downpayment`, but the client has
 * never confirmed what LCP is or how it relates to the item total, so
 * computing from it would bake in a guess about money.
 */
export function PaperRecordFields({ control, errors }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Proposed Purchase &amp; Paper Record
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          LCP, PPD rebate and the first due date are filled in from the price list and the term
          above — correct them if the signed paper says otherwise, since the paper is the source of
          truth. All fields are required.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-zinc-600">LCP (₱) {REQUIRED}</label>
          <Controller
            name="lcp"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="number"
                min={0}
                step="0.01"
                className={fieldClass}
              />
            )}
          />
          <FieldError message={errors.lcp?.message} />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            PPD rebate (₱) {REQUIRED}
          </label>
          <Controller
            name="ppdRebate"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="number"
                min={0}
                step="0.01"
                className={fieldClass}
              />
            )}
          />
          <FieldError message={errors.ppdRebate?.message} />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            First due date {REQUIRED}
          </label>
          <Controller
            name="firstDueDate"
            control={control}
            render={({ field }) => (
              <input {...field} value={field.value ?? ''} type="date" className={fieldClass} />
            )}
          />
          <FieldError message={errors.firstDueDate?.message} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Down payment collection {REQUIRED}
          </label>
          <Controller
            name="downPaymentCollection"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onChange={field.onChange}
                options={DP_COLLECTION}
                placeholder="Where it was collected…"
                compact
              />
            )}
          />
          <FieldError message={errors.downPaymentCollection?.message} />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            POS draft / quote ID {REQUIRED}
          </label>
          <Controller
            name="posDraftReference"
            control={control}
            render={({ field }) => (
              <input {...field} value={field.value ?? ''} maxLength={100} className={fieldClass} />
            )}
          />
          <FieldError message={errors.posDraftReference?.message} />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Applicant is unit user {REQUIRED}
          </label>
          <Controller
            name="applicantIsUnitUser"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onChange={field.onChange}
                options={YES_NO}
                placeholder="Select"
                compact
              />
            )}
          />
          <FieldError message={errors.applicantIsUnitUser?.message} />
        </div>
      </div>

      <Controller
        name="paperFormConfirmed"
        control={control}
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Paper form fully complete and signed {REQUIRED}
          </label>
        )}
      />
      <FieldError message={errors.paperFormConfirmed?.message} />
    </div>
  )
}
