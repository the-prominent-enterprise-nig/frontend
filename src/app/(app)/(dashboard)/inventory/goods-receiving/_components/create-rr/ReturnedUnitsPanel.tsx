'use client'

import { Plus, Trash2, X } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import {
  InstallmentAccountSearchCombobox,
  type InstallmentAccountMeta,
} from '@/src/components/inventory/InstallmentAccountSearchCombobox'
import { RepossessionCustomerSearchCombobox } from '@/src/components/inventory/RepossessionCustomerSearchCombobox'
import {
  RepossessedSerialSearchCombobox,
  type RepossessedSerialMeta,
} from '@/src/components/inventory/RepossessedSerialSearchCombobox'
import { ItemSearchCombobox } from '../../../purchase-requests/_components/ItemSearchCombobox'
import { MONO, fmtPeso } from '../../../purchase-orders/_components/procurementTokens'
import type { InstallmentAccountUnitItem } from '../../_actions/get-installment-account'
import { PANEL } from './rrTokens'
import type { RrLine } from './rrTotals'

/** One invoice the units are coming back from. Its checked units are the
 * receipt's lines (linked by installmentAccountId), so this holds only what
 * the panel needs to show — never what gets posted. */
export type ReturnBlock = {
  key: string
  accountId: string
  invoiceLabel?: string
  customerId: string
  customerLabel: string
  /** Customer ID shown on the form — the customer's code. */
  customerCode?: string
  /** undefined until the invoice's units have loaded. */
  units?: InstallmentAccountUnitItem[]
  loading: boolean
  /** Every unit on this invoice has already been taken back. */
  exhausted: boolean
  fallbackSerialLabel?: string
}

type Props = {
  mode: 'repossession' | 'repair_return'
  blocks: ReturnBlock[]
  lines: RrLine[]
  canViewCost: boolean
  showErrors: boolean
  itemNameFor: (itemId?: string) => string | undefined
  onPickInvoice: (key: string, id: string, meta?: InstallmentAccountMeta, label?: string) => void
  onPickCustomer: (key: string, id: string, label?: string) => void
  onToggleUnit: (key: string, unit: InstallmentAccountUnitItem, checked: boolean) => void
  onFallbackItem: (key: string, option: SearchComboboxOption) => void
  onFallbackSerial: (key: string, id: string, meta?: RepossessedSerialMeta, label?: string) => void
  /** serialNumberId names a checked unit; omitted, it means the block's
   * hand-entered fallback line. */
  onUnitCost: (key: string, serialNumberId: string | undefined, value: number | undefined) => void
  onAddBlock: () => void
  onRemoveBlock: (key: string) => void
}

const CAPTION = `${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`

/**
 * Units coming back from a customer — repossession and repair/return share
 * this one layout. Pick the invoice, the customer fills in, and every unit on
 * the invoice is listed as Serial # – Model – Brand with a checkbox; only the
 * checked ones become lines on the receipt.
 */
export function ReturnedUnitsPanel({
  mode,
  blocks,
  lines,
  canViewCost,
  showErrors,
  itemNameFor,
  onPickInvoice,
  onPickCustomer,
  onToggleUnit,
  onFallbackItem,
  onFallbackSerial,
  onUnitCost,
  onAddBlock,
  onRemoveBlock,
}: Props): React.ReactElement {
  const isRepo = mode === 'repossession'
  const checkedCount = lines.filter((l) => l?.itemId && l.existingSerialNumberIds?.[0]).length
  const noneChecked = checkedCount === 0
  const totalCost = lines.reduce((sum, line) => sum + (Number(line?.unitCost) || 0), 0)

  return (
    <div className={PANEL}>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4.5 py-3.5 ${
          showErrors && noneChecked ? 'border-[#b42318]' : 'border-[#eeeef1]'
        }`}
        data-invalid={showErrors && noneChecked ? true : undefined}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[13.5px] font-semibold">
              {isRepo ? 'Repossessed Items' : 'Units for Repair/Return'}{' '}
              <span className="text-[#b42318]">*</span>
            </span>
            <span className="text-[11px] text-[#8b8b9b]">
              {checkedCount} {checkedCount === 1 ? 'unit' : 'units'} checked
            </span>
          </div>
          <span
            className={`text-[11.5px] ${showErrors && noneChecked ? 'text-[#b42318]' : 'text-[#8b8b9b]'}`}
          >
            {showErrors && noneChecked
              ? 'Check at least one unit.'
              : 'Search the invoice, then check the units coming back. Only checked units go on the receipt.'}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddBlock}
          className="flex items-center gap-1 rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-1.5 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another invoice
        </button>
      </div>

      {blocks.map((block) => (
        <Block
          key={block.key}
          block={block}
          isRepo={isRepo}
          lines={lines}
          canViewCost={canViewCost}
          showErrors={showErrors}
          itemNameFor={itemNameFor}
          canRemove={blocks.length > 1}
          onPickInvoice={onPickInvoice}
          onPickCustomer={onPickCustomer}
          onToggleUnit={onToggleUnit}
          onFallbackItem={onFallbackItem}
          onFallbackSerial={onFallbackSerial}
          onUnitCost={onUnitCost}
          onRemoveBlock={onRemoveBlock}
        />
      ))}

      {isRepo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-[#e4e4e9] bg-[#fbfbfc] px-4.5 py-3">
          <span className="text-[11.5px] text-[#8b8b9b]">
            Repo cost = list price − payments received (monthly + down payment) + agent commission
            (none if Office) — the value each unit re-enters stock at.
          </span>
          {canViewCost && (
            <span className="text-[11.5px] text-[#3d3d4a]">{fmtPeso(totalCost)} total</span>
          )}
        </div>
      )}
    </div>
  )
}

function Block({
  block,
  isRepo,
  lines,
  canViewCost,
  showErrors,
  itemNameFor,
  canRemove,
  onPickInvoice,
  onPickCustomer,
  onToggleUnit,
  onFallbackItem,
  onFallbackSerial,
  onUnitCost,
  onRemoveBlock,
}: {
  block: ReturnBlock
  isRepo: boolean
  lines: RrLine[]
  canViewCost: boolean
  showErrors: boolean
  itemNameFor: (itemId?: string) => string | undefined
  canRemove: boolean
  onPickInvoice: Props['onPickInvoice']
  onPickCustomer: Props['onPickCustomer']
  onToggleUnit: Props['onToggleUnit']
  onFallbackItem: Props['onFallbackItem']
  onFallbackSerial: Props['onFallbackSerial']
  onUnitCost: Props['onUnitCost']
  onRemoveBlock: Props['onRemoveBlock']
}): React.ReactElement {
  const hasInvoice = !!block.accountId
  const units = block.units ?? []
  // No linked sale to list units from (hand-entered/imported account, or every
  // unit already taken back): the item + serial are searched by hand instead.
  const manual = hasInvoice && block.units !== undefined && units.length === 0
  const manualLine = manual
    ? lines.find((l) => l?.installmentAccountId === block.accountId)
    : undefined
  const isChecked = (unit: InstallmentAccountUnitItem): boolean =>
    lines.some(
      (l) =>
        l?.installmentAccountId === block.accountId &&
        !!unit.serialNumberId &&
        l.existingSerialNumberIds?.[0] === unit.serialNumberId
    )

  return (
    <div className="border-t border-[#f1f1f4] bg-white px-4.5 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className={CAPTION}>Invoice #</span>
          <InstallmentAccountSearchCombobox
            key={block.accountId || 'none'}
            value={block.accountId}
            onChange={(id) => onPickInvoice(block.key, id)}
            onSelect={(option: SearchComboboxOption) =>
              onPickInvoice(
                block.key,
                option.id,
                option.meta as InstallmentAccountMeta,
                option.primary
              )
            }
            initialLabel={block.invoiceLabel}
            customerId={block.customerId || undefined}
            error={showErrors && !hasInvoice && lines.length === 0 ? 'Pick the invoice' : undefined}
            placeholder="Search by invoice number…"
            typeToSearchMessage="Type an invoice number to search…"
          />

          <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
            <div className="min-w-0">
              <span className={CAPTION}>{isRepo ? 'Repossessed from' : 'Returned by'}</span>
              {block.customerId ? (
                <div className="flex h-9.5 items-center justify-between gap-2 rounded-lg border border-[#e4e4e9] bg-[#fbfbfc] px-3 text-[13px]">
                  <span className="min-w-0 truncate text-[#17171c]">
                    {block.customerLabel || 'Customer'}
                  </span>
                  {!hasInvoice && (
                    <Tooltip label="Change" side="bottom" align="end">
                      <button
                        type="button"
                        onClick={() => onPickCustomer(block.key, '')}
                        aria-label="Change customer"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#a3a3b2] hover:bg-[#eeeef1] hover:text-[#17171c]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              ) : (
                <RepossessionCustomerSearchCombobox
                  value=""
                  onChange={(id) => onPickCustomer(block.key, id)}
                  onSelect={(option: SearchComboboxOption) =>
                    onPickCustomer(block.key, option.id, option.primary)
                  }
                />
              )}
            </div>
            <div className="min-w-0">
              <span className={CAPTION}>Customer ID</span>
              <div
                className={`${MONO} flex h-9.5 items-center rounded-lg border border-[#e4e4e9] bg-[#f5f5f7] px-3 text-[12.5px] ${
                  block.customerCode ? 'text-[#17171c]' : 'text-[#a3a3b2]'
                }`}
              >
                {block.customerCode ?? 'Fills in from the customer'}
              </div>
            </div>
          </div>
        </div>

        {canRemove && (
          <Tooltip label="Remove invoice" side="bottom" align="end">
            <button
              type="button"
              onClick={() => onRemoveBlock(block.key)}
              aria-label="Remove invoice"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8b8b9b] hover:bg-[#fdeceb] hover:text-[#b42318]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>

      {hasInvoice && block.loading && (
        <div className="mt-2.5 text-[11px] text-[#8b8b9b]">Loading this invoice&rsquo;s units…</div>
      )}

      {units.length > 0 && (
        <div className="mt-3">
          <span className={CAPTION}>Units on this invoice — check what is coming back</span>
          <ul className="overflow-hidden rounded-[9px] border border-[#ddd0f7]">
            {units.map((unit) => {
              const checked = isChecked(unit)
              return (
                <li key={unit.id} className="border-b border-[#eee8fb] last:border-b-0">
                  <label
                    className={`flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 ${
                      checked ? 'bg-[#faf7ff]' : 'bg-white hover:bg-[#fbfbfc]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onToggleUnit(block.key, unit, e.target.checked)}
                      aria-label={`Check ${unit.serialNumber ?? 'unit'}`}
                      className="h-4 w-4 shrink-0 accent-[#5b21b6]"
                    />
                    <span className={`${MONO} text-[12.5px] text-[#17171c]`}>
                      {unit.serialNumber ?? '—'}
                    </span>
                    <span className="text-[#c4c4cf]">–</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#17171c]">
                      {unit.modelNumber || unit.itemName || '—'}
                    </span>
                    <span className="text-[#c4c4cf]">–</span>
                    <span className="text-[12.5px] text-[#5b5b6b]">{unit.brand || '—'}</span>
                    {isRepo && canViewCost && checked && unit.repoCost > 0 && (
                      <span className={`${MONO} text-[12px] text-[#0b6644]`}>
                        {fmtPeso(unit.repoCost)}
                      </span>
                    )}
                  </label>
                  {isRepo && canViewCost && checked && !(unit.repoCost > 0) && (
                    <UnitCostInput
                      line={lines.find(
                        (l) =>
                          l?.installmentAccountId === block.accountId &&
                          l.existingSerialNumberIds?.[0] === unit.serialNumberId
                      )}
                      showErrors={showErrors}
                      onChange={(v) => onUnitCost(block.key, unit.serialNumberId ?? undefined, v)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {manual && (
        <div className="mt-2.5 flex flex-col gap-2.5 rounded-[9px] border border-[#f7dfc0] bg-[#fffdf8] px-3 py-2.5">
          <span className="text-[11px] text-[#8a4b06]">
            {block.exhausted
              ? 'Every unit on this invoice has already been taken back — pick a different invoice, or search below.'
              : 'No linked catalog sale on this invoice — pick the item and its serial manually.'}
          </span>
          <div
            className={`grid grid-cols-1 gap-2.5 ${isRepo ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
          >
            <ItemSearchCombobox
              value={manualLine?.itemId ?? ''}
              onChange={() => {}}
              initialLabel={itemNameFor(manualLine?.itemId)}
              onSelect={(option) => onFallbackItem(block.key, option)}
              compact
            />
            <RepossessedSerialSearchCombobox
              itemId={manualLine?.itemId ?? ''}
              value={manualLine?.existingSerialNumberIds?.[0] ?? ''}
              onChange={(id) => onFallbackSerial(block.key, id)}
              onSelect={(option: SearchComboboxOption) =>
                onFallbackSerial(
                  block.key,
                  option.id,
                  option.meta as RepossessedSerialMeta,
                  option.primary
                )
              }
              initialLabel={block.fallbackSerialLabel}
            />
            {isRepo && canViewCost && (
              <input
                type="number"
                step="0.01"
                min="0"
                value={manualLine?.unitCost ?? ''}
                onChange={(e) =>
                  onUnitCost(
                    block.key,
                    undefined,
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                placeholder="Cost"
                aria-label="Cost"
                className={`${MONO} h-9.5 w-full rounded-lg border ${
                  showErrors && manualLine?.itemId && !(Number(manualLine.unitCost) > 0)
                    ? 'border-[#b42318]'
                    : 'border-[#d3d3db]'
                } bg-white px-2.5 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function UnitCostInput({
  line,
  showErrors,
  onChange,
}: {
  line?: RrLine
  showErrors: boolean
  onChange: (value: number | undefined) => void
}): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 bg-[#faf7ff] px-3 pb-2.5 pl-10">
      <span className="text-[10.5px] text-[#8a4b06]">No cost on record —</span>
      <input
        type="number"
        step="0.01"
        min="0.01"
        value={line?.unitCost ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        placeholder="Cost"
        aria-label="Cost"
        className={`${MONO} h-8 w-28 rounded-md border ${
          showErrors && !(Number(line?.unitCost) > 0) ? 'border-[#b42318]' : 'border-[#d3d3db]'
        } bg-white px-2 text-[12px] outline-none focus:border-[#5b21b6]`}
      />
    </div>
  )
}
