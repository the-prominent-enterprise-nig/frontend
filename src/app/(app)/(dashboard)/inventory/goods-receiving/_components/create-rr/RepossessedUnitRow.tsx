'use client'

import { Trash2, X } from 'lucide-react'
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
import type { LineIssue } from '../../../purchase-orders/_components/receive-po/receiveIssues'
import type { InstallmentAccountUnitItem } from '../../_actions/get-installment-account'
import type { RrLine } from './rrTotals'

type Props = {
  line: RrLine
  itemName?: string
  serialLabel?: string
  cost?: number
  /** Whether the RESOLVED unit itself had a usable recorded cost — decides
   * whether Cost renders read-only or as an input. Deliberately not derived
   * from `cost`/line.unitCost live: those change as the receiver types, and
   * swapping the input out from under them the instant it crosses 0 would
   * make typing a real figure impossible. */
  hasOriginalCost: boolean
  canViewCost: boolean
  showErrors: boolean
  issues: LineIssue[]
  customerId?: string
  customerLabel?: string
  onCustomerChange: (id: string, label?: string) => void
  installmentAccountLabel?: string
  onInstallmentAccountChange: (id: string, meta?: InstallmentAccountMeta, label?: string) => void
  /** The picked account's own currently-repossessable units (already
   * excludes anything with a prior repossession on record) — undefined =
   * nothing picked yet or still loading, [] = nothing left to auto-resolve
   * (the fallback path — see accountExhausted for which kind of "nothing"),
   * >1 = a real choice to make. */
  unitItems?: InstallmentAccountUnitItem[]
  unitItemsLoading?: boolean
  /** True when the [] above means "every unit on this account has already
   * been repossessed" rather than "this account never had a linked sale to
   * begin with" — same fallback UI either way, different explanation. */
  accountExhausted?: boolean
  onPickUnit: (unitItem: InstallmentAccountUnitItem) => void
  /** Fallback path only (unitItems resolved to []). */
  onSelectFallbackItem: (option: SearchComboboxOption) => void
  fallbackSerialLabel?: string
  onFallbackSerialChange: (id: string, meta?: RepossessedSerialMeta, label?: string) => void
  /** Sets the line's unitCost directly — used by the fallback path (nothing
   * to derive a cost from) and, in the resolved path, whenever the original
   * sale itself recorded no usable cost (missing or zero): the item/serial
   * still resolve automatically, but a real cost has to come from somewhere,
   * and receiveStock() requires a positive number when one is sent at all. */
  onCostChange: (value: number | undefined) => void
  onRemove: () => void
}

/**
 * One repossessed unit — not a purchase line, so it carries none of the
 * purchase-receiving machinery (quantity beyond 1, SRP, discounts, tax/
 * withholding, freebie, QC hold). Just who it came from, which account,
 * and what's resolved from that: the item, its serial, and the cost it
 * re-enters stock at (developer-confirmed 2026-09-28 — Manual RR repossession
 * redesign).
 */
export function RepossessedUnitRow({
  line,
  itemName,
  serialLabel,
  cost,
  hasOriginalCost,
  canViewCost,
  showErrors,
  issues,
  customerId,
  customerLabel,
  onCustomerChange,
  installmentAccountLabel,
  onInstallmentAccountChange,
  unitItems,
  unitItemsLoading,
  accountExhausted,
  onPickUnit,
  onSelectFallbackItem,
  fallbackSerialLabel,
  onFallbackSerialChange,
  onCostChange,
  onRemove,
}: Props): React.ReactElement {
  const fallback = unitItems?.length === 0
  const resolved = !!line.itemId && !fallback
  const needsUnitPick = !!line.installmentAccountId && (unitItems?.length ?? 0) > 1 && !line.itemId

  return (
    <div className="border-t border-[#f1f1f4] bg-white px-4.5 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <span
              className={`${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`}
            >
              Invoice #
            </span>
            {/* Same underlying search as Installment below (it already
                matches invoice numbers too) — just framed as its own field,
                first, for a receiver who has the physical invoice in hand
                and nothing else. Picking here resolves everything:
                customer, account, item, serial, cost. */}
            <InstallmentAccountSearchCombobox
              key={line.installmentAccountId ?? 'none'}
              value={line.installmentAccountId ?? ''}
              onChange={(id) => onInstallmentAccountChange(id)}
              onSelect={(option: SearchComboboxOption) =>
                onInstallmentAccountChange(
                  option.id,
                  option.meta as InstallmentAccountMeta,
                  option.primary
                )
              }
              initialLabel={installmentAccountLabel}
              placeholder="Search by invoice number…"
              typeToSearchMessage="Type an invoice number to search…"
            />
          </div>

          {/* Repossessed From + Installment, together, below the invoice
              search — Repossessed From flattens into a plain readout once
              resolved (developer-confirmed 2026-09-29): it's never itself
              the thing being searched for, just whoever comes with
              whichever account was found. Installment stays a live,
              editable search the whole time — it's what actually decides
              the item, so a receiver still needs to be able to search/change
              it directly even after the customer is known. */}
          <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
            <div className="min-w-0">
              <span
                className={`${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`}
              >
                Repossessed from
              </span>
              {customerId ? (
                <div className="flex h-9.5 items-center justify-between gap-2 rounded-lg border border-[#e4e4e9] bg-[#fbfbfc] px-3 text-[13px]">
                  <span className="min-w-0 truncate text-[#17171c]">
                    {customerLabel || 'Customer'}
                  </span>
                  <Tooltip label="Change" side="bottom" align="end">
                    <button
                      type="button"
                      onClick={() => onCustomerChange('')}
                      aria-label="Change repossessed-from customer"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#a3a3b2] hover:bg-[#eeeef1] hover:text-[#17171c]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>
              ) : (
                <RepossessionCustomerSearchCombobox
                  value=""
                  onChange={(id) => onCustomerChange(id)}
                  onSelect={(option: SearchComboboxOption) =>
                    onCustomerChange(option.id, option.primary)
                  }
                />
              )}
            </div>
            <div className="min-w-0">
              <span
                className={`${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`}
              >
                Installment
              </span>
              <InstallmentAccountSearchCombobox
                key={line.installmentAccountId ?? 'none'}
                value={line.installmentAccountId ?? ''}
                onChange={(id) => onInstallmentAccountChange(id)}
                onSelect={(option: SearchComboboxOption) =>
                  onInstallmentAccountChange(
                    option.id,
                    option.meta as InstallmentAccountMeta,
                    option.primary
                  )
                }
                initialLabel={installmentAccountLabel}
                customerId={customerId || undefined}
              />
            </div>
          </div>
        </div>

        <Tooltip label="Remove" side="bottom" align="end">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove repossessed unit"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8b8b9b] hover:bg-[#fdeceb] hover:text-[#b42318]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>

      {line.installmentAccountId && unitItemsLoading && (
        <div className="mt-2.5 text-[11px] text-[#8b8b9b]">Loading this account&rsquo;s units…</div>
      )}

      {resolved && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[9px] border border-[#ddd0f7] bg-[#faf7ff] px-3 py-2.5">
          <span className={`${MONO} text-[9.5px] uppercase tracking-[.09em] text-[#7c4fd1]`}>
            Item
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#17171c]">
            {itemName ?? 'Item'}
          </span>
          <span className={`${MONO} text-[9.5px] uppercase tracking-[.09em] text-[#7c4fd1]`}>
            Serial
          </span>
          <span className={`${MONO} text-[12.5px] text-[#17171c]`}>{serialLabel ?? '—'}</span>
          {canViewCost &&
            (hasOriginalCost ? (
              <span className={`${MONO} text-[12.5px] text-[#0b6644]`}>
                {cost != null ? fmtPeso(cost) : '—'}
              </span>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-[10.5px] text-[#8a4b06]">No cost on record —</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={line.unitCost ?? ''}
                  onChange={(e) =>
                    onCostChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  placeholder="Cost"
                  aria-label="Cost"
                  className={`${MONO} h-8 w-28 rounded-md border ${
                    showErrors && !line.unitCost ? 'border-[#b42318]' : 'border-[#d3d3db]'
                  } bg-white px-2 text-[12px] outline-none focus:border-[#5b21b6]`}
                />
              </div>
            ))}
        </div>
      )}

      {needsUnitPick && (
        <div className="mt-2.5">
          <span
            className={`${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`}
          >
            Which unit?
          </span>
          <select
            value=""
            onChange={(e) => {
              const unit = unitItems?.find((u) => u.serialNumberId === e.target.value)
              if (unit) onPickUnit(unit)
            }}
            aria-label="Which unit was repossessed"
            className="h-9.5 w-full max-w-md rounded-lg border border-[#d3d3db] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
          >
            <option value="" disabled>
              Select a unit…
            </option>
            {(unitItems ?? [])
              .filter((u) => !!u.serialNumberId)
              .map((u) => (
                <option key={u.id} value={u.serialNumberId ?? ''}>
                  {u.itemName ? `${u.itemName} · ${u.serialNumber}` : u.serialNumber}
                </option>
              ))}
          </select>
        </div>
      )}

      {fallback && (
        <div className="mt-2.5 flex flex-col gap-2.5 rounded-[9px] border border-[#f7dfc0] bg-[#fffdf8] px-3 py-2.5">
          <span className="text-[11px] text-[#8a4b06]">
            {accountExhausted
              ? 'Every unit on this account has already been repossessed — pick a different account, or search below (nothing sold under this account is still available).'
              : 'No linked catalog sale on this account — pick the item, its serial, and its cost manually.'}
          </span>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <ItemSearchCombobox
              value={line.itemId ?? ''}
              onChange={() => {}}
              initialLabel={itemName}
              onSelect={onSelectFallbackItem}
              compact
            />
            <RepossessedSerialSearchCombobox
              itemId={line.itemId ?? ''}
              value={line.existingSerialNumberIds?.[0] ?? ''}
              onChange={(id) => onFallbackSerialChange(id)}
              onSelect={(option: SearchComboboxOption) =>
                onFallbackSerialChange(
                  option.id,
                  option.meta as RepossessedSerialMeta,
                  option.primary
                )
              }
              initialLabel={fallbackSerialLabel}
            />
            {canViewCost && (
              <input
                type="number"
                step="0.01"
                min="0"
                value={line.unitCost ?? ''}
                onChange={(e) =>
                  onCostChange(e.target.value === '' ? undefined : Number(e.target.value))
                }
                placeholder="Cost"
                aria-label="Cost"
                className={`${MONO} h-9.5 w-full rounded-lg border border-[#d3d3db] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`}
              />
            )}
          </div>
        </div>
      )}

      {issues.map((issue, n) => (
        <div
          key={n}
          className={`mt-2 flex items-center gap-2 text-[11.5px] ${
            issue.kind === 'error' ? 'text-[#b42318]' : 'text-[#8a4b06]'
          }`}
        >
          <span
            className={`inline-block h-[5px] w-[5px] shrink-0 rounded-full ${
              issue.kind === 'error' ? 'bg-[#b42318]' : 'bg-[#b25e09]'
            }`}
          />
          <span className="min-w-0 flex-1">{issue.text}</span>
        </div>
      ))}

      {showErrors && !line.installmentAccountId && (
        <div className="mt-2 flex items-center gap-2 text-[11.5px] text-[#b42318]">
          <span className="inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-[#b42318]" />
          Pick who this unit is being repossessed from, and which account.
        </div>
      )}
    </div>
  )
}
