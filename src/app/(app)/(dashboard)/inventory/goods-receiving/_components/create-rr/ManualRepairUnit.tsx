'use client'

import { useQuery } from '@tanstack/react-query'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { getBrands } from '../../../brands/_actions/get-brands'
import { MONO } from '../../../purchase-orders/_components/procurementTokens'

const CAPTION = `${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`

const INPUT = `${MONO} h-9.5 w-full rounded-lg border bg-white px-2.5 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc] disabled:bg-[#f5f5f7]`

type Props = {
  brandId?: string
  model: string
  serial: string
  showErrors: boolean
  onBrand: (brandId: string) => void
  onModel: (value: string) => void
  onSerial: (value: string) => void
  /** Optional — the number off the customer's old receipt. */
  invoice: string
  onInvoice: (value: string) => void
  onCancel: () => void
}

/**
 * Repair intake for an existing customer's unit that was never sold through
 * this system, so there is no invoice to list it from: Brand is picked from
 * the catalog; Model and Serial are typed off the unit. The server matches the
 * model to that brand's item, else files it under the brand's Customer unit.
 */
export function ManualRepairUnit({
  brandId,
  model,
  serial,
  showErrors,
  onBrand,
  onModel,
  onSerial,
  invoice,
  onInvoice,
  onCancel,
}: Props): React.ReactElement {
  const brands = useQuery({
    queryKey: ['inventory-item-brands'],
    queryFn: () => getBrands(),
    staleTime: 30 * 1000,
  })
  const brandOptions = (brands.data?.data ?? []).map((b) => ({ value: b.id, label: b.name }))
  const modelMissing = showErrors && !!brandId && !model.trim()
  const serialMissing = showErrors && !!brandId && !serial.trim()

  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-[9px] border border-[#ddd0f7] bg-[#faf7ff] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-ink-muted">
          Unit not in the system — pick its brand, then type the model and serial from the unit.
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11.5px] font-medium text-[#3f1490] hover:underline"
        >
          Search an invoice instead
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <span className={CAPTION}>Brand</span>
          <SearchableSelect
            portal
            ariaLabel="Brand"
            value={brandId ?? ''}
            onChange={(value) => onBrand(value)}
            options={brandOptions}
            loading={brands.isLoading}
            placeholder="Pick the brand…"
          />
        </div>
        <div className="min-w-0">
          <span className={CAPTION}>Model</span>
          <input
            type="text"
            value={model}
            onChange={(e) => onModel(e.target.value)}
            disabled={!brandId}
            maxLength={100}
            placeholder={brandId ? 'Type the model on the unit' : 'Pick the brand first'}
            aria-label="Model"
            className={`${INPUT} ${modelMissing ? 'border-[#b42318]' : 'border-[#d3d3db]'}`}
          />
        </div>
        <div className="min-w-0">
          <span className={CAPTION}>Serial #</span>
          <input
            type="text"
            value={serial}
            onChange={(e) => onSerial(e.target.value)}
            disabled={!brandId}
            placeholder={brandId ? 'Type the serial on the unit' : 'Pick the brand first'}
            aria-label="Serial number"
            className={`${INPUT} ${serialMissing ? 'border-[#b42318]' : 'border-[#d3d3db]'}`}
          />
        </div>
        <div className="min-w-0">
          <span className={CAPTION}>
            Invoice # <span className="normal-case tracking-normal text-ink-subtle">optional</span>
          </span>
          <input
            type="text"
            value={invoice}
            onChange={(e) => onInvoice(e.target.value)}
            maxLength={60}
            placeholder="From the customer's old receipt"
            aria-label="Old invoice number"
            className={`${INPUT} border-[#d3d3db]`}
          />
        </div>
      </div>
    </div>
  )
}
