'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { Truck } from 'lucide-react'
import type { CreateTransferFormValues } from '@/src/schema/inventory/transfers'
import { VehicleAutocompleteInput, type AutocompleteOption } from './VehicleAutocompleteInput'
import { searchVehicles } from '../_actions/search-vehicles'
import { searchDrivers } from '../_actions/search-drivers'

type Props = {
  control: Control<CreateTransferFormValues>
  errors?: FieldErrors<NonNullable<CreateTransferFormValues['delivery']>>
}

const inputClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-[13px] text-[#17171c] outline-none transition-colors focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'
const labelClass = 'mb-1.5 block text-[12px] font-medium text-[#3d3d4a]'

// Same rosters as the dispatch form on an opened transfer: any branch's
// vehicles and drivers, with the branch shown to tell them apart.
async function vehicleOptions(query: string): Promise<AutocompleteOption[]> {
  const result = await searchVehicles({ q: query })
  if (!result.success || !result.data) return []
  return result.data.map((v) => ({
    id: v.id,
    label: v.plateNo,
    sublabel: [v.tag, v.branch?.name].filter(Boolean).join(' · ') || null,
  }))
}

async function driverOptions(query: string): Promise<AutocompleteOption[]> {
  const result = await searchDrivers({ q: query })
  if (!result.success || !result.data) return []
  return result.data.map((d) => ({ id: d.id, label: d.name, sublabel: d.branch?.name }))
}

function TextField({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<CreateTransferFormValues>
  name: 'delivery.driverPhone' | 'delivery.carrierName' | 'delivery.notes'
  label: string
  placeholder: string
}): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            {...field}
            value={field.value ?? ''}
            type="text"
            placeholder={placeholder}
            className={inputClass}
          />
        )}
      />
    </div>
  )
}

/** The delivery half of a stockbook dispatch — what the dispatch step asks for. */
export function DispatchDeliveryFields({ control, errors }: Props): React.JSX.Element {
  return (
    <div className="rounded-xl border border-[#e4e4e9] bg-white">
      <div className="flex items-center gap-2 border-b border-[#eeeef1] px-[18px] py-[13px]">
        <Truck className="h-4 w-4 text-[#5b21b6]" />
        <span className="text-[13.5px] font-semibold text-[#17171c]">Delivery</span>
      </div>
      <div className="grid gap-3 px-[18px] py-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Vehicle plate <span className="text-[#b42318]">*</span>
          </label>
          <Controller
            name="delivery.vehiclePlate"
            control={control}
            render={({ field }) => (
              <VehicleAutocompleteInput
                mono
                value={field.value ?? ''}
                onChange={field.onChange}
                onPick={(option) => field.onChange(option.label)}
                search={vehicleOptions}
                queryKey="stockbook-dispatch-vehicle-search"
                placeholder="e.g. ABC 1234"
                error={errors?.vehiclePlate?.message}
              />
            )}
          />
        </div>
        <div>
          <label className={labelClass}>Driver name</label>
          <Controller
            name="delivery.driverName"
            control={control}
            render={({ field }) => (
              <VehicleAutocompleteInput
                noun="drivers"
                value={field.value ?? ''}
                onChange={field.onChange}
                onPick={(option) => field.onChange(option.label)}
                search={driverOptions}
                queryKey="stockbook-dispatch-driver-search"
                placeholder="e.g. Juan dela Cruz"
                error={errors?.driverName?.message}
              />
            )}
          />
        </div>
        <TextField
          control={control}
          name="delivery.driverPhone"
          label="Driver phone"
          placeholder="e.g. 09171234567"
        />
        <TextField
          control={control}
          name="delivery.carrierName"
          label="Carrier / logistics company"
          placeholder="e.g. LBC Express"
        />
        <div className="sm:col-span-2">
          <TextField
            control={control}
            name="delivery.notes"
            label="Dispatch notes"
            placeholder="Optional dispatch notes…"
          />
        </div>
      </div>
    </div>
  )
}
