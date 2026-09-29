'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { Building2, CalendarRange, MapPin } from 'lucide-react'
import type { CreateTransferFormValues } from '@/src/schema/inventory/transfers'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import { formatShortDate } from '@/src/libs/format/date'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { MONO, CONTROL_CHROME } from '../../purchase-orders/_components/procurementTokens'

// Scenario 60 Part 2 — the caravan half of New Stock Transfer's destination.
// A caravan is a temporary branch set up at a real host branch for an event;
// both panels here exist so whoever handles the stock can see, at a glance,
// that it is meant for that event and where it is being held.

const labelClass = 'mb-1.5 block text-[12px] font-medium text-[#3d3d4a]'
const inputClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-[13px] text-[#17171c] outline-none transition-colors focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'
const errorClass = 'mt-1 text-[11.5px] text-[#b42318]'
const panelClass = 'rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] p-3.5'
const panelTitleClass = `${MONO} mb-2.5 text-[10px] tracking-[0.09em] text-[#7c4fd1] uppercase`

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
      <p className={panelTitleClass}>New caravan</p>
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

/** The chosen caravan spelled out — event, where it is set up, whose
 * branch it belongs to, and when. */
export function CaravanSummary({ warehouse }: { warehouse: WarehouseSummary }): React.JSX.Element {
  const branch = warehouse.branch
  const host = branch?.hostBranch?.name ?? 'the host branch'
  const dates =
    branch?.startDate && branch.endDate
      ? `${formatShortDate(branch.startDate)} – ${formatShortDate(branch.endDate)}`
      : '—'
  return (
    <div data-testid="caravan-destination-summary" className={panelClass}>
      <p className={panelTitleClass}>Caravan destination</p>
      <dl className="grid gap-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem label="Event">{branch?.eventName ?? branch?.name ?? '—'}</SummaryItem>
        <SummaryItem label="Location">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#7c4fd1]" />
          {branch?.addressLine1?.trim() || '—'}
        </SummaryItem>
        <SummaryItem label="Host branch">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-[#7c4fd1]" />
          {host}
        </SummaryItem>
        <SummaryItem label="Event dates">
          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-[#7c4fd1]" />
          {dates}
        </SummaryItem>
      </dl>
      <p className="mt-2.5 text-[11px] text-[#5b5b6b]">
        {host} receives these units for this caravan. They are sold through {host}&apos;s POS and
        count toward {host}&apos;s daily collection.
      </p>
    </div>
  )
}

function SummaryItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[#8b8b9b]">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-[#17171c]">{children}</dd>
    </div>
  )
}
