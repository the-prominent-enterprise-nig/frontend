'use client'

import { PackagePlus, Plus } from 'lucide-react'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import type { RepossessedSerialMeta } from '@/src/components/inventory/RepossessedSerialSearchCombobox'
import type { LineIssue } from '../../../purchase-orders/_components/receive-po/receiveIssues'
import type { InstallmentAccountUnitItem } from '../../_actions/get-installment-account'
import { RepossessedUnitRow } from './RepossessedUnitRow'
import { PANEL } from './rrTokens'
import { fmtPeso } from '../../../purchase-orders/_components/procurementTokens'
import type { RrLine } from './rrTotals'

type Field = { id: string }

type Props = {
  fields: Field[]
  lines: RrLine[]
  canViewCost: boolean
  showErrors: boolean
  issuesFor: (index: number) => LineIssue[]
  itemNameFor: (itemId?: string) => string | undefined
  /** Resolves a picked serial's display string from the account's own
   * unitItems — the form only ever stores the SerialNumber id. */
  serialLabelFor: (fieldId: string, serialNumberId?: string) => string | undefined
  /** Whether the resolved unit itself had a usable recorded cost — decides
   * whether the row shows it read-only or offers a Cost input instead. */
  hasOriginalCostFor: (fieldId: string, serialNumberId?: string) => boolean
  customerIdFor: (fieldId: string) => string | undefined
  customerLabelFor: (fieldId: string) => string | undefined
  onCustomerChange: (index: number, id: string, label?: string) => void
  installmentAccountLabelFor: (fieldId: string) => string | undefined
  onInstallmentAccountChange: (
    index: number,
    id: string,
    meta?: { customerId: string },
    label?: string
  ) => void
  unitItemsFor: (fieldId: string) => InstallmentAccountUnitItem[] | undefined
  unitItemsLoadingFor: (fieldId: string) => boolean | undefined
  /** True when the picked account had a linked schedule but every one of
   * its units has already been repossessed — vs. never having had one at
   * all (a hand-entered/imported account), which reads the same as far as
   * unitItemsFor's own empty array goes. */
  accountExhaustedFor: (fieldId: string) => boolean | undefined
  onPickUnit: (index: number, unitItem: InstallmentAccountUnitItem) => void
  onSelectFallbackItem: (index: number, option: SearchComboboxOption) => void
  fallbackSerialLabelFor: (fieldId: string) => string | undefined
  onFallbackSerialChange: (
    index: number,
    id: string,
    meta?: RepossessedSerialMeta,
    label?: string
  ) => void
  onCostChange: (index: number, value: number | undefined) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

/**
 * Replaces the purchase-style "Items received" grid entirely for a
 * repossession — not a modified version of it. A repossession isn't "N units
 * of one item arriving together" the way a delivery is: it's one specific
 * unit, from one specific customer/account, at a time, so this is a plain
 * list of resolved units rather than a line-with-quantity-and-slots grid
 * (developer-confirmed 2026-09-28).
 */
export function RepossessedItemsPanel({
  fields,
  lines,
  canViewCost,
  showErrors,
  issuesFor,
  itemNameFor,
  serialLabelFor,
  hasOriginalCostFor,
  customerIdFor,
  customerLabelFor,
  onCustomerChange,
  installmentAccountLabelFor,
  onInstallmentAccountChange,
  unitItemsFor,
  unitItemsLoadingFor,
  accountExhaustedFor,
  onPickUnit,
  onSelectFallbackItem,
  fallbackSerialLabelFor,
  onFallbackSerialChange,
  onCostChange,
  onAdd,
  onRemove,
}: Props): React.ReactElement {
  const hasLines = fields.length > 0
  const totalCost = lines.reduce((sum, line) => sum + (Number(line?.unitCost) || 0), 0)

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[13.5px] font-semibold">
              Repossessed Items <span className="text-[#b42318]">*</span>
            </span>
            <span className="text-[11px] text-[#8b8b9b]">
              {fields.length} {fields.length === 1 ? 'unit' : 'units'}
            </span>
          </div>
          <span className="text-[11.5px] text-[#8b8b9b]">
            Pick who it&rsquo;s from, then which account — the item and serial resolve on their own.
          </span>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-1.5 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add repossessed unit
        </button>
      </div>

      {!hasLines ? (
        <div className="flex flex-col items-center gap-2 px-5.5 py-10 text-center">
          <PackagePlus className="h-7 w-7 text-[#d3d3db]" />
          <span className="text-[13.5px] font-semibold">No units added yet.</span>
          <span className="max-w-[430px] text-[12px] leading-[1.55] text-[#5b5b6b]">
            Add a unit, then say who it&rsquo;s being repossessed from.
          </span>
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 rounded-lg bg-[#5b21b6] px-3.75 py-2.25 text-[13px] font-medium text-white hover:bg-[#4a189b]"
          >
            Add a unit
          </button>
        </div>
      ) : (
        <>
          {fields.map((field, index) => {
            const line = lines[index]
            if (!line) return null
            return (
              <RepossessedUnitRow
                key={field.id}
                line={line}
                itemName={itemNameFor(line.itemId)}
                serialLabel={serialLabelFor(field.id, line.existingSerialNumberIds?.[0])}
                hasOriginalCost={hasOriginalCostFor(field.id, line.existingSerialNumberIds?.[0])}
                cost={line.unitCost != null ? Number(line.unitCost) : undefined}
                canViewCost={canViewCost}
                showErrors={showErrors}
                issues={issuesFor(index)}
                customerId={customerIdFor(field.id)}
                customerLabel={customerLabelFor(field.id)}
                onCustomerChange={(id, label) => onCustomerChange(index, id, label)}
                installmentAccountLabel={installmentAccountLabelFor(field.id)}
                onInstallmentAccountChange={(id, meta, label) =>
                  onInstallmentAccountChange(index, id, meta, label)
                }
                unitItems={unitItemsFor(field.id)}
                unitItemsLoading={unitItemsLoadingFor(field.id)}
                accountExhausted={accountExhaustedFor(field.id)}
                onPickUnit={(unitItem) => onPickUnit(index, unitItem)}
                onSelectFallbackItem={(option) => onSelectFallbackItem(index, option)}
                fallbackSerialLabel={fallbackSerialLabelFor(field.id)}
                onFallbackSerialChange={(id, meta, label) =>
                  onFallbackSerialChange(index, id, meta, label)
                }
                onCostChange={(value) => onCostChange(index, value)}
                onRemove={() => onRemove(index)}
              />
            )
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-[#e4e4e9] bg-[#fbfbfc] px-4.5 py-3">
            <span className="text-[11.5px] text-[#8b8b9b]">
              Repo cost = list price − payments received (monthly + down payment) + agent commission
              (none if Office) — the value each unit re-enters stock at.
            </span>
            {canViewCost && (
              <span className="text-[11.5px] text-[#3d3d4a]">{fmtPeso(totalCost)} total</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
