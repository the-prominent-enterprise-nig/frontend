'use client'

import { useQuery } from '@tanstack/react-query'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import { getBrands } from '../../../brands/_actions/get-brands'
import { getItems } from '../../../items/_actions/get-items'
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
  /** Repair only: a model missing from the catalog can still be typed (the
   * server files it under the brand's Customer unit). A returned or
   * repossessed unit goes back on the shelf, so it must be a catalog model. */
  allowUnlisted?: boolean
  /** Extra fields for this kind of receipt — a return's price and what
   * happens to the unit, a repossession's Repo Cost. */
  children?: React.ReactNode
}

/** The brand's serial-tracked model numbers — what the server matches the
 * picked model against. A model typed in that isn't one of them is kept as an
 * option so the box still shows it. */
function useModelOptions(
  brandId: string | undefined,
  model: string
): {
  options: SearchableSelectOption[]
  loading: boolean
  /** The lookup failed — the list is empty because of that, not the brand. */
  error?: string
} {
  const items = useQuery({
    queryKey: ['inventory-items', 'brand-models', brandId],
    queryFn: () => getItems({ brandId, limit: 500 }),
    enabled: !!brandId,
    staleTime: 30 * 1000,
  })
  const models = (items.data?.data?.data ?? [])
    .filter((item) => item.isSerialTracked && item.modelNumber?.trim())
    .map((item) => item.modelNumber!.trim())
  const typed = model.trim()
  if (typed && !models.some((m) => m.toLowerCase() === typed.toLowerCase())) models.push(typed)
  const unique = [...new Set(models)].sort((a, b) => a.localeCompare(b))
  const failed = items.isError || items.data?.success === false
  return {
    options: unique.map((m) => ({ value: m, label: m })),
    loading: items.isLoading,
    error: failed ? items.data?.message || items.data?.error || 'Request failed' : undefined,
  }
}

/**
 * A customer's unit that was never sold through this system, so there is no
 * invoice to list it from — on a repair, return or repossession: Brand is
 * picked from the catalog; Model from that brand's models (a repair may type
 * one that isn't listed); Serial is typed off the unit. The server matches the
 * model to that brand's item.
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
  allowUnlisted = true,
  children,
}: Props): React.ReactElement {
  const brands = useQuery({
    queryKey: ['inventory-item-brands'],
    queryFn: () => getBrands(),
    staleTime: 30 * 1000,
  })
  const brandOptions = (brands.data?.data ?? []).map((b) => ({ value: b.id, label: b.name }))
  const models = useModelOptions(brandId, model)
  const modelMissing = showErrors && !!brandId && !model.trim()
  const serialMissing = showErrors && !!brandId && !serial.trim()

  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-[9px] border border-[#ddd0f7] bg-[#faf7ff] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-ink-muted">
          Unit not in the system — pick its brand and model, then type the serial from the unit.
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
          <SearchableSelect
            portal
            ariaLabel="Model"
            value={model}
            onChange={(value) => onModel(value)}
            options={models.options}
            loading={models.loading}
            disabled={!brandId}
            chrome={{
              idle: modelMissing ? 'border-[#b42318]' : 'border-[#d3d3db]',
              focused: 'border-[#5b21b6] ring-1 ring-[#5b21b6]',
            }}
            placeholder={brandId ? 'Pick the model…' : 'Pick the brand first'}
            emptyAction={
              allowUnlisted
                ? {
                    label: (typed) => `Use "${typed}" — not in the catalog`,
                    onSelect: (typed) => onModel(typed.slice(0, 100)),
                  }
                : undefined
            }
          />
          {models.error && (
            <span className="mt-1 block text-[11px] text-[#b42318]">
              Couldn&apos;t load this brand&apos;s models ({models.error})
              {allowUnlisted ? ' — type the model instead.' : '.'}
            </span>
          )}
          {!allowUnlisted && !models.error && !!brandId && !models.loading && (
            <span className="mt-1 block text-[11px] text-ink-subtle">
              Not listed? Add the model in Item Master first.
            </span>
          )}
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
      {children}
    </div>
  )
}
