'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, Search, X } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import { MONO } from '../../purchase-orders/_components/procurementTokens'

export type PickedSerial = { id: string; serialNumber?: string }

type Props = {
  fromWarehouseId: string
  itemId: string
  selected: PickedSerial[]
  onChange: (next: PickedSerial[]) => void
}

const PAGE_SIZE = 50

/** Waits for typing to settle so each keystroke isn't its own request. */
function useDebounced(value: string, delayMs = 250): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

/**
 * Names the exact units a serial-tracked line sends. Only units in stock at
 * the source and not already claimed by another open transfer are offered —
 * the same set the backend accepts at create (assertRequestedSerialsFree).
 */
export default function TransferSerialPicker({
  fromWarehouseId,
  itemId,
  selected,
  onChange,
}: Props) {
  const [search, setSearch] = useState('')
  // The option list is a dropdown — shown only while the search box is in
  // use, so a line doesn't carry a standing list of every unit at the source.
  const [open, setOpen] = useState(false)
  const debouncedSearch = useDebounced(search.trim())

  const optionsQuery = useQuery({
    queryKey: ['transfer-serial-picker', fromWarehouseId, itemId, debouncedSearch],
    queryFn: () =>
      getSerialNumbers({
        warehouseId: fromWarehouseId,
        itemId,
        status: 'in_stock',
        freeForTransfer: true,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
      }),
    enabled: !!fromWarehouseId && !!itemId,
    staleTime: 30 * 1000,
  })
  const options = optionsQuery.data?.data?.data ?? []
  const total = optionsQuery.data?.data?.total ?? 0

  // A line seeded from Item 360 arrives with ids only — borrow the label
  // from the option list once it's loaded.
  const labelOf = (s: PickedSerial): string =>
    s.serialNumber || options.find((o) => o.id === s.id)?.serialNumber || '…'

  // Pin the label onto a seeded pick the first time it's seen, so it still
  // reads right once a search narrows the option list.
  useEffect(() => {
    if (!selected.some((s) => !s.serialNumber)) return
    const filled = selected.map((s) =>
      s.serialNumber ? s : { ...s, serialNumber: options.find((o) => o.id === s.id)?.serialNumber }
    )
    if (filled.some((s, i) => s.serialNumber !== selected[i].serialNumber)) onChange(filled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  const selectedIds = new Set(selected.map((s) => s.id))
  const toggle = (option: { id: string; serialNumber: string }): void => {
    onChange(
      selectedIds.has(option.id)
        ? selected.filter((s) => s.id !== option.id)
        : [...selected, { id: option.id, serialNumber: option.serialNumber }]
    )
  }

  if (!fromWarehouseId) {
    return (
      <p className="text-[11.5px] text-[#8b8b9b]">
        Choose the source branch first to see which serials it holds.
      </p>
    )
  }

  return (
    <div data-testid="serial-pick-panel" className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s.id}
              className={`${MONO} inline-flex items-center gap-1 rounded-md border border-[#d9ccf3] bg-[#f5f0fd] py-0.5 pr-1 pl-2 text-[11.5px] text-[#3f1490]`}
            >
              {labelOf(s)}
              <Tooltip label="Remove serial">
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
                  aria-label={`Remove ${labelOf(s)}`}
                  className="rounded p-0.5 text-[#7c5cc4] hover:bg-[#e6dbfa] hover:text-[#3f1490]"
                >
                  <X className="h-3 w-3" />
                </button>
              </Tooltip>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#a3a3b2]" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder="Search serial number to add…"
          aria-label="Search serial numbers at the source"
          className="w-full rounded-lg border border-[#d3d3db] bg-white py-1.5 pr-3 pl-8 text-[12.5px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
        />

        {open && (
          <div
            // Keeps focus on the input, so picking several in a row doesn't
            // blur-close the list after each one.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute top-full right-0 left-0 z-20 mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-[#e4e4e9] bg-white shadow-[0_8px_24px_rgba(23,23,28,0.12)]"
          >
            {optionsQuery.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-[#8b8b9b]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading serials…
              </div>
            ) : options.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-[#8b8b9b]">
                {debouncedSearch
                  ? 'No free serial at the source matches that.'
                  : 'No free serials of this item at the source.'}
              </p>
            ) : (
              options.map((option) => {
                const checked = selectedIds.has(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(option)}
                    className={`flex w-full items-center gap-2.5 border-b border-[#f4f4f6] px-3 py-1.5 text-left last:border-b-0 ${
                      checked ? 'bg-[#faf7ff]' : 'hover:bg-[#fbfbfc]'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? 'border-[#5b21b6] bg-[#5b21b6] text-white'
                          : 'border-[#c9c9d3] bg-white'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className={`${MONO} text-[12px] text-[#17171c]`}>
                      {option.serialNumber}
                    </span>
                  </button>
                )
              })
            )}
            {total > options.length && (
              <p className="border-t border-[#f4f4f6] px-3 py-1.5 text-[11px] text-[#8b8b9b]">
                Showing {options.length} of {total} — keep typing to narrow down.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
