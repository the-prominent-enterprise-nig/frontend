'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import type { CreateTransferFormValues } from '@/src/schema/inventory/transfers'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { CONTROL_CHROME } from '../../purchase-orders/_components/procurementTokens'

// Scenario 60 Part 2 — the "For a caravan" half of New Stock Transfer.
// A caravan is a temporary branch set up at a real host branch for an event;
// its details are captured here so whoever handles the stock can see, at a
// glance, that it is meant for that event and where it is being held.

const labelClass = 'mb-1.5 block text-[12px] font-medium text-[#3d3d4a]'
const inputClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-[13px] text-[#17171c] outline-none transition-colors focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'
const errorClass = 'mt-1 text-[11.5px] text-[#b42318]'
const panelClass = 'rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] p-3.5'

type NewCaravanFieldsProps = {
  control: Control<CreateTransferFormValues>
  errors: FieldErrors<CreateTransferFormValues>
  hostBranchOptions: { value: string; label: string }[]
  // A branch-scoped user can only host a caravan at their own branch.
  hostLocked: boolean
}

export function NewCaravanFields({
  control,
  errors,
  hostBranchOptions,
  hostLocked,
}: NewCaravanFieldsProps): React.JSX.Element {
  const err = errors.newCaravan
  return (
    <div data-testid="new-caravan-fields" className={panelClass}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Host branch <span className="text-[#b42318]">*</span>
          </label>
          <Controller
            name="newCaravan.hostBranchId"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                value={field.value ?? ''}
                onChange={field.onChange}
                disabled={hostLocked}
                placeholder="Search host branch…"
                chrome={CONTROL_CHROME}
                options={hostBranchOptions}
              />
            )}
          />
          <p className="mt-1 text-[11px] text-[#5b5b6b]">
            The branch this caravan belongs to. Its stock is recorded under this branch and sold on
            its POS.
          </p>
          {err?.hostBranchId && <p className={errorClass}>{err.hostBranchId.message}</p>}
        </div>
        <div>
          <label className={labelClass}>
            Event name <span className="text-[#b42318]">*</span>
          </label>
          <Controller
            name="newCaravan.eventName"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="text"
                maxLength={150}
                placeholder="e.g. Bago City Fiesta Appliance Fair"
                className={inputClass}
              />
            )}
          />
          {err?.eventName && <p className={errorClass}>{err.eventName.message}</p>}
        </div>
      </div>
      <div className="mt-3">
        <label className={labelClass}>Location</label>
        <Controller
          name="newCaravan.location"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              value={field.value ?? ''}
              type="text"
              maxLength={255}
              placeholder="e.g. SM City Bacolod, Ground Floor Atrium"
              className={inputClass}
            />
          )}
        />
        <p className="mt-1 text-[11px] text-[#5b5b6b]">
          Where the caravan is physically set up, so staff know where these units are going.
        </p>
        {err?.location && <p className={errorClass}>{err.location.message}</p>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DateField
          control={control}
          name="newCaravan.startDate"
          label="Start date"
          error={err?.startDate?.message}
        />
        <DateField
          control={control}
          name="newCaravan.endDate"
          label="End date"
          error={err?.endDate?.message}
        />
      </div>
      <p className="mt-2.5 text-[11px] text-[#5b5b6b]">
        The caravan is listed as a branch until its end date. Remaining stock can still be
        transferred out after it ends.
      </p>
    </div>
  )
}

type DateFieldProps = {
  control: Control<CreateTransferFormValues>
  name: 'newCaravan.startDate' | 'newCaravan.endDate'
  label: string
  error?: string
}

function DateField({ control, name, label, error }: DateFieldProps): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>
        {label} <span className="text-[#b42318]">*</span>
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input {...field} value={field.value ?? ''} type="date" className={inputClass} />
        )}
      />
      {error && <p className={errorClass}>{error}</p>}
    </div>
  )
}
