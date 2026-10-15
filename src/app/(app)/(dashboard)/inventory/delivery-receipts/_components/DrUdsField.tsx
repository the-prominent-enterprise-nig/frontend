'use client'

/* Scenario 72 Part 7 — the repair ticket a repair-purpose DR moves. The DR
 * replaces the UDS's own "Send to Service Centre" / "Release to Customer"
 * steps, so the unit, the warehouse and the recipient all come from the
 * sheet; the backend derives them again on save, this only shows them. */

import { useEffect } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { CONTROL_CHROME } from '@/src/libs/design/plex'
import type {
  DrFormValues,
  DrLineFormValues,
  DrUdsLookup,
} from '@/src/schema/inventory/delivery-receipts'
import { getDrEligibleUds } from '../_actions/dr-lookups'
import { Field } from './drFormUi'

function udsLines(uds: DrUdsLookup): DrLineFormValues[] {
  return uds.lines.map((l) => ({
    itemId: l.itemId,
    itemLabel: l.item.name,
    isSerialTracked: l.item.isSerialTracked,
    serials: [{ id: l.serialNumberId, label: l.serialNumber.serialNumber }],
    quantity: 1,
    modelNumber: l.item.modelNumber ?? '',
    brandName: l.item.brand?.name ?? '',
    unitCost: null,
    costTyped: false,
  }))
}

function optionLabel(uds: DrUdsLookup): string {
  const who = uds.repairProvider?.name ?? uds.customer?.name
  const unit = uds.lines[0]?.serialNumber.serialNumber
  return [uds.code, who, unit].filter(Boolean).join(' · ')
}

export function DrUdsField({ error }: { error?: string }): React.JSX.Element {
  const { control, setValue, getValues } = useFormContext<DrFormValues>()
  const [purpose, udsId, udsLabel] = useWatch({ control, name: ['purpose', 'udsId', 'udsLabel'] })
  const eligible = useQuery({
    queryKey: ['dr-eligible-uds', purpose],
    queryFn: () => getDrEligibleUds(purpose),
    staleTime: 30_000,
  })
  const rows = eligible.data ?? []

  function apply(uds: DrUdsLookup): void {
    const opts = { shouldDirty: true, shouldValidate: false }
    const toProvider = purpose === 'to_service_center'
    const party = toProvider ? uds.repairProvider : uds.customer
    setValue('udsId', uds.id, opts)
    setValue('udsLabel', uds.code, opts)
    if (uds.warehouseId) setValue('warehouseId', uds.warehouseId, opts)
    setValue('lines', udsLines(uds), opts)
    setValue('supplierId', toProvider ? (party?.id ?? '') : '', opts)
    setValue('supplierLabel', toProvider ? (party?.name ?? '') : '', opts)
    setValue('customerId', toProvider ? '' : (party?.id ?? ''), opts)
    setValue('customerLabel', toProvider ? '' : (party?.name ?? ''), opts)
    setValue('deliveredTo', party?.name ?? '', opts)
  }

  // Arriving from the UDS list (?udsId=) presets the id only; fill the rest
  // once the sheet is in the list.
  useEffect(() => {
    if (!udsId || getValues('lines').length > 0) return
    const row = rows.find((r) => r.id === udsId)
    if (row) apply(row)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, udsId])

  const options = rows.map((r) => ({ value: r.id, label: optionLabel(r) }))
  if (udsId && !options.some((o) => o.value === udsId)) {
    options.unshift({ value: udsId, label: udsLabel || 'Selected ticket' })
  }
  return (
    <Field label="Repair ticket (UDS)" required error={error}>
      <Controller
        control={control}
        name="udsId"
        render={({ field }) => (
          <SearchableSelect
            value={field.value}
            onChange={(value) => {
              const row = rows.find((r) => r.id === value)
              if (row) apply(row)
            }}
            options={options}
            loading={eligible.isLoading}
            placeholder={
              !eligible.isLoading && rows.length === 0
                ? 'No repair tickets are ready for this step'
                : 'Select repair ticket…'
            }
            chrome={CONTROL_CHROME}
          />
        )}
      />
    </Field>
  )
}
