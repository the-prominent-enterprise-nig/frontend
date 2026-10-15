'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import type { ServiceCenterUnit } from '@/src/schema/inventory/goods-receiving/service-center-units'
import {
  getServiceCenterUnits,
  searchServiceCenterSerials,
} from '../../_actions/service-center-units'
import { MONO, fmtPeso } from '../../../purchase-orders/_components/procurementTokens'
import { PANEL } from './rrTokens'

type Props = {
  serviceCenterId: string
  serviceCenterName?: string
  /** The units ticked so far — they become the receipt's lines. */
  picked: ServiceCenterUnit[]
  /** Actual repair cost per ticked unit, by serialNumberId. */
  costs: Record<string, number | undefined>
  canViewCost: boolean
  showErrors: boolean
  onToggle: (unit: ServiceCenterUnit, checked: boolean) => void
  onCost: (serialNumberId: string, value: number | undefined) => void
}

const CAPTION = `${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`

const KIND_LABEL: Record<ServiceCenterUnit['kind'], string> = {
  at_provider: 'Out at the service center',
  not_dispatched: 'On a ticket, never sent out in the system',
  no_ticket: 'No repair ticket — one is raised on this receipt',
}

/**
 * Scenario 73 — units coming back "From Service Center": only the units out
 * at the picked service center are listed (never another service center's,
 * never ones already back). A unit that reached it another way — a paper DR,
 * or before the system — is found by serial underneath.
 */
export function ServiceCenterUnitsPanel(props: Props): React.ReactElement {
  const { serviceCenterId, serviceCenterName, picked, showErrors } = props
  const unitsQuery = useQuery({
    queryKey: ['service-center-units', serviceCenterId],
    queryFn: () => getServiceCenterUnits(serviceCenterId),
    enabled: !!serviceCenterId,
  })
  const listed = unitsQuery.data?.data ?? []
  const extra = picked.filter((p) => !listed.some((u) => u.serialNumberId === p.serialNumberId))
  const noneChecked = picked.length === 0

  return (
    <div className={PANEL}>
      <div
        className={`flex flex-col gap-0.5 border-b px-4.5 py-3.5 ${
          showErrors && noneChecked ? 'border-[#b42318]' : 'border-[#eeeef1]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[13.5px] font-semibold">
            Units back from {serviceCenterName || 'the service center'}{' '}
            <span className="text-[#b42318]">*</span>
          </span>
          <span className="text-[11px] text-[#8b8b9b]">
            {picked.length} {picked.length === 1 ? 'unit' : 'units'} checked
          </span>
        </div>
        <span
          className={`text-[11.5px] ${showErrors && noneChecked ? 'text-[#b42318]' : 'text-[#8b8b9b]'}`}
        >
          {showErrors && noneChecked
            ? 'Check at least one unit.'
            : 'Only units delivered to this service center are listed. Check the ones that came back.'}
        </span>
      </div>

      <div className="flex flex-col gap-3 bg-white px-4.5 py-3.5">
        {!serviceCenterId ? (
          <Empty text="Pick the service center above to list the units out there." />
        ) : unitsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[11.5px] text-[#8b8b9b]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the units out there…
          </div>
        ) : listed.length === 0 ? (
          <Empty
            text={`No units are out at ${serviceCenterName || 'this service center'}. Only units sent on a "For repair to service center" DR or a UDS dispatch are listed — search by serial below for one that went out another way.`}
          />
        ) : (
          <UnitList units={listed} {...props} />
        )}

        {extra.length > 0 && (
          <div>
            <span className={CAPTION}>Added by serial</span>
            <UnitList units={extra} {...props} />
          </div>
        )}

        {serviceCenterId && <SerialSearch {...props} />}
      </div>
    </div>
  )
}

function UnitList({
  units,
  picked,
  costs,
  canViewCost,
  showErrors,
  onToggle,
  onCost,
}: Props & { units: ServiceCenterUnit[] }): React.ReactElement {
  return (
    <ul className="overflow-hidden rounded-[9px] border border-[#ddd0f7]">
      {units.map((unit) => {
        const checked = picked.some((p) => p.serialNumberId === unit.serialNumberId)
        return (
          <li key={unit.serialNumberId} className="border-b border-[#eee8fb] last:border-b-0">
            <label
              className={`flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 ${
                checked ? 'bg-[#faf7ff]' : 'bg-white hover:bg-[#fbfbfc]'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(unit, e.target.checked)}
                aria-label={`Check ${unit.serialNumber}`}
                className="h-4 w-4 shrink-0 accent-[#5b21b6]"
              />
              <UnitSummary unit={unit} />
            </label>
            {checked && canViewCost && (
              <CostInput
                unit={unit}
                value={costs[unit.serialNumberId]}
                showErrors={showErrors}
                onChange={(v) => onCost(unit.serialNumberId, v)}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function UnitSummary({ unit }: { unit: ServiceCenterUnit }): React.ReactElement {
  const facts = [
    unit.customer?.name,
    unit.uds?.code,
    unit.uds?.dispatchDeliveryReceiptNumber && `DR ${unit.uds.dispatchDeliveryReceiptNumber}`,
  ].filter(Boolean)
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5">
        <span className={`${MONO} text-[12.5px] text-[#17171c]`}>{unit.serialNumber}</span>
        <span className="text-[#c4c4cf]">–</span>
        <span className="min-w-0 truncate text-[12.5px] text-[#17171c]">
          {unit.item.modelNumber || unit.item.name}
        </span>
        <span className="text-[#c4c4cf]">–</span>
        <span className="text-[12.5px] text-[#5b5b6b]">{unit.item.brand || '—'}</span>
      </span>
      <span className="truncate text-[11px] text-[#8b8b9b]">
        {facts.length > 0 ? facts.join(' · ') : KIND_LABEL[unit.kind]}
        {unit.kind !== 'at_provider' && facts.length > 0 && ` · ${KIND_LABEL[unit.kind]}`}
      </span>
    </span>
  )
}

function CostInput({
  unit,
  value,
  showErrors,
  onChange,
}: {
  unit: ServiceCenterUnit
  value: number | undefined
  showErrors: boolean
  onChange: (value: number | undefined) => void
}): React.ReactElement {
  const estimate = unit.uds?.repairEstimatedCost
  const bad = showErrors && value !== undefined && value < 0
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-[#faf7ff] px-3 pb-2.5 pl-10">
      <span className="text-[10.5px] text-[#5b5b6b]">Actual repair cost</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        placeholder="Cost"
        aria-label={`Actual repair cost for ${unit.serialNumber}`}
        className={`${MONO} h-8 w-28 rounded-md border ${
          bad ? 'border-[#b42318]' : 'border-[#d3d3db]'
        } bg-white px-2 text-[12px] outline-none focus:border-[#5b21b6]`}
      />
      <span className="text-[10.5px] text-[#8b8b9b]">
        {estimate != null
          ? `Estimate ${fmtPeso(estimate)} — leave as is if the bill is not in yet.`
          : 'No estimate on the ticket — blank posts nothing yet.'}
      </span>
    </div>
  )
}

function SerialSearch({ serviceCenterId, picked, onToggle }: Props): React.ReactElement {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const search = useQuery({
    queryKey: ['service-center-serial-search', serviceCenterId, q],
    queryFn: () => searchServiceCenterSerials(serviceCenterId, q),
    enabled: q.length >= 3,
  })
  const results = (search.data?.data ?? []).filter(
    (u) => !picked.some((p) => p.serialNumberId === u.serialNumberId)
  )
  const run = (): void => setQ(draft.trim())

  return (
    <div className="rounded-[9px] border border-dashed border-[#d3d3db] px-3 py-2.5">
      <span className={CAPTION}>Unit not listed? Search by serial</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            run()
          }}
          placeholder="At least 3 characters of the serial…"
          aria-label="Search by serial"
          className={`${MONO} h-9 min-w-0 flex-1 rounded-lg border border-[#d3d3db] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#5b21b6]`}
        />
        <button
          type="button"
          onClick={run}
          disabled={draft.trim().length < 3}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-3 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa] disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </button>
      </div>
      {q.length >= 3 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {search.isLoading ? (
            <span className="text-[11px] text-[#8b8b9b]">Searching…</span>
          ) : results.length === 0 ? (
            <span className="text-[11px] text-[#8b8b9b]">
              Nothing found that could have come back from this service center. A unit out at
              another service center, or already back, is never offered.
            </span>
          ) : (
            results.map((unit) => (
              <div
                key={unit.serialNumberId}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#eeeef1] px-3 py-2"
              >
                <UnitSummary unit={unit} />
                <button
                  type="button"
                  onClick={() => onToggle(unit, true)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-[#ddd0f7] bg-[#f1ebfb] px-2.5 py-1 text-[12px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }): React.ReactElement {
  return (
    <div className="rounded-[9px] border border-dashed border-[#d3d3db] px-4 py-5 text-center text-[11.5px] leading-relaxed text-[#8b8b9b]">
      {text}
    </div>
  )
}
