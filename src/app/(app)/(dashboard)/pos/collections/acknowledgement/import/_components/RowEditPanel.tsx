'use client'

import { AlertTriangle, Check } from 'lucide-react'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import SegmentedControl from '@/src/components/ui/SegmentedControl'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type {
  AcknowledgementImportCells,
  AcknowledgementImportRow,
} from '@/src/schema/pos/acknowledgement-import'
import type { ImportLookups } from '../_hooks/useImportLookups'
import {
  CLEARED_LABELS,
  RECEIPT_TYPE_LABELS,
  clearedLabel,
  dateToInput,
  matchLabel,
} from '../_lib/cells'

// Same look as the New Receipt form's inputs and labels.
const INPUT = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm'
const LABEL = 'block text-xs font-medium text-gray-800'

function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className}`}>
      <span className={`${LABEL} mb-1`}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="border-b border-gray-200 pb-1.5 text-sm font-semibold text-prominent-purple-900">
        {title}
      </h3>
      {/* Columns follow the review section's width (@container up in
          ImportReceiptsView), not the window's: one under 640px, two from 640,
          three from 1000 — the sidebar leaves a 1024px window far less than
          1024px of content. */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 pt-3 @min-[640px]:grid-cols-2 @min-[1000px]:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

/** A name the file carries that the list doesn't have still has to show — as
 * what it is — or the picker would look blank while the row says it's wrong. */
function withCurrent(options: SearchableSelectOption[], current: string): SearchableSelectOption[] {
  const value = current.trim()
  if (!value || options.some((o) => o.value === value)) return options
  return [{ value, label: `${value} (not found)` }, ...options]
}

function withCurrentAccount(
  options: CategorySelectOption[],
  current: string
): CategorySelectOption[] {
  const value = current.trim()
  if (!value || options.some((o) => o.id === value)) return options
  return [{ id: value, name: `${value} (not in chart)`, depth: 0 }, ...options]
}

/** Every field of one import row as a labelled input — the CSV's own cells,
 * editable in place, grouped the way a receipt reads: the receipt itself, who
 * it is for, how it cleared, and the amounts. Flat, attached under the row;
 * each change goes straight to the row's cells as the same text the file would
 * have held, and the screen re-checks the rows shortly after typing pauses. */
export default function RowEditPanel({
  row,
  cells,
  lookups,
  disabled,
  onChange,
  onClose,
  onRemove,
}: {
  row: AcknowledgementImportRow
  cells: AcknowledgementImportCells
  lookups: ImportLookups
  disabled?: boolean
  onChange: (patch: AcknowledgementImportCells) => void
  onClose: () => void
  onRemove: () => void
}) {
  const cell = (key: string) => cells[key] ?? ''
  // The canonical label when the cell names one (case aside), else the raw
  // text — so a wrong value still shows, flagged "(not found)".
  const receiptType =
    matchLabel(cell('receiptType'), RECEIPT_TYPE_LABELS) || cell('receiptType').trim()
  const cleared = clearedLabel(cell('cleared'))
  const dateInput = dateToInput(cell('date'))
  const clearDateInput = dateToInput(cell('clearDate'))
  // A date cell the input can't show (anything but YYYY-MM-DD / MM/DD/YYYY).
  const unreadableDate = !!cell('date').trim() && !dateInput
  const unreadableClearDate = !!cell('clearDate').trim() && !clearDateInput

  const branchOptions = withCurrent(
    lookups.branchNames.map((n) => ({ value: n, label: n })),
    cell('branch')
  )
  const bankOptions = withCurrent(
    lookups.bankAccounts.map((b) => ({
      value: b.name,
      label: b.name,
      description: b.bankName && b.bankName !== 'N/A' ? b.bankName : undefined,
    })),
    cell('receivedIn')
  )
  const subsidyOptions = withCurrentAccount(lookups.accountOptions, cell('subsidyAccount'))
  const withholdingOptions = withCurrentAccount(lookups.accountOptions, cell('withholdingAccount'))
  const optionName = (options: CategorySelectOption[], id: string) =>
    options.find((o) => o.id === id.trim())?.name

  const text = (key: string, placeholder?: string) => (
    <input
      value={cell(key)}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange({ [key]: e.target.value })}
      className={INPUT}
    />
  )
  // An amount the way a statement reads: right-aligned, figures lined up.
  const amount = (key: string, label: string) => (
    <input
      aria-label={label}
      value={cell(key)}
      disabled={disabled}
      inputMode="decimal"
      onChange={(e) => onChange({ [key]: e.target.value })}
      className={`${INPUT} text-right tabular-nums`}
    />
  )

  const { calculatedNet, uploadedNet } = row.data
  const netDifference = uploadedNet === null ? null : uploadedNet - calculatedNet
  const netMatches = netDifference !== null && Math.abs(netDifference) < 0.005

  return (
    <div className="space-y-6">
      <Section title="Receipt">
        <Field label="Receipt Type">
          <SearchableSelect
            portal
            value={receiptType}
            onChange={(value) => onChange({ receiptType: value })}
            options={withCurrent(
              RECEIPT_TYPE_LABELS.map((l) => ({ value: l, label: l })),
              receiptType
            )}
            placeholder="Select receipt type…"
            disabled={disabled}
          />
        </Field>
        <Field label="Branch">
          <SearchableSelect
            portal
            clearable
            value={cell('branch').trim()}
            onChange={(value) => onChange({ branch: value })}
            options={branchOptions}
            placeholder={lookups.branchesLoading ? 'Loading branches…' : '— Not tracked —'}
            disabled={disabled || lookups.branchesLoading}
          />
        </Field>
        <Field label="Date" hint={unreadableDate ? `File had: ${cell('date')}` : undefined}>
          <input
            type="date"
            value={dateInput}
            disabled={disabled}
            onChange={(e) => onChange({ date: e.target.value })}
            className={INPUT}
          />
        </Field>
        <Field label="Reference">{text('reference', 'Optional')}</Field>
        <Field label="Description" className="@min-[640px]:col-span-2">
          {text('description', 'Optional')}
        </Field>
      </Section>

      <Section title="Customer & invoice">
        <Field
          label="Customer"
          hint="An unknown name is added as a new customer."
          className="@min-[640px]:col-span-2"
        >
          {text('customer')}
        </Field>
        <Field label="Sales Invoice No.">{text('invoiceNo')}</Field>
      </Section>

      <Section title="Clearing">
        <Field label="Cleared" className="@min-[640px]:col-span-2">
          {/* The segments are as wide as the cell gives them, and their labels
              never wrap. */}
          <div className="[&_button]:whitespace-nowrap">
            <SegmentedControl
              name="Cleared"
              value={cleared}
              onChange={(value) =>
                onChange(
                  value === 'Same date' ? { cleared: value, clearDate: '' } : { cleared: value }
                )
              }
              options={CLEARED_LABELS.map((l) => ({ value: l, label: l }))}
            />
          </div>
        </Field>
        <Field
          label="Clear Date"
          hint={unreadableClearDate ? `File had: ${cell('clearDate')}` : undefined}
        >
          <input
            type="date"
            value={clearDateInput}
            disabled={disabled || cleared === 'Same date'}
            onChange={(e) => onChange({ clearDate: e.target.value })}
            className={`${INPUT} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
          />
        </Field>
        <Field label="Received in" className="@min-[640px]:col-span-2">
          <SearchableSelect
            portal
            clearable
            value={cell('receivedIn').trim()}
            onChange={(value) => onChange({ receivedIn: value })}
            options={bankOptions}
            placeholder="— Not tracked —"
            disabled={disabled}
          />
        </Field>
      </Section>

      <section>
        <h3 className="border-b border-gray-200 pb-1.5 text-sm font-semibold text-prominent-purple-900">
          Amounts
        </h3>
        {/* One grid for all four rows, so the labels, figures, accounts and
            notes line up down the page like a statement. */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 pt-3 @min-[1000px]:grid-cols-[9rem_10rem_minmax(0,1fr)_9rem] @min-[1000px]:items-center">
          <span className={LABEL}>Gross</span>
          {amount('gross', 'Gross')}
          <span className="hidden @min-[1000px]:block" />
          <span className="hidden text-xs text-gray-500 @min-[1000px]:block">AR amount</span>

          <span className={`${LABEL} mt-3 @min-[1000px]:mt-0`}>Subsidy</span>
          {amount('subsidy', 'Subsidy')}
          <div title={optionName(subsidyOptions, cell('subsidyAccount'))}>
            <CategorySelect
              aria-label="Subsidy account"
              value={cell('subsidyAccount').trim() || undefined}
              onChange={(value) => onChange({ subsidyAccount: value ?? '' })}
              options={subsidyOptions}
              placeholder="Default: Sales Discounts and Rebates"
              noun="accounts"
              disabled={disabled}
            />
          </div>
          <span className="hidden text-xs text-gray-500 @min-[1000px]:block">Debit</span>

          <span className={`${LABEL} mt-3 @min-[1000px]:mt-0`}>Withholding tax</span>
          {amount('withholding', 'Withholding tax')}
          <div title={optionName(withholdingOptions, cell('withholdingAccount'))}>
            <CategorySelect
              aria-label="Withholding tax account"
              value={cell('withholdingAccount').trim() || undefined}
              onChange={(value) => onChange({ withholdingAccount: value ?? '' })}
              options={withholdingOptions}
              placeholder="Pick the account it is credited to"
              noun="accounts"
              disabled={disabled}
            />
          </div>
          <span className="hidden text-xs text-gray-500 @min-[1000px]:block">Credit</span>

          <span className={`${LABEL} mt-3 @min-[1000px]:mt-0`}>Net amount</span>
          {amount('net', 'Net amount')}
          <span className="hidden @min-[1000px]:block" />
          <span className="hidden text-xs text-gray-500 @min-[1000px]:block">Credited to bank</span>

          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-gray-700 @min-[1000px]:col-span-3 @min-[1000px]:col-start-2">
            <span>
              Calculated net{' '}
              <span className="font-medium tabular-nums text-gray-900">
                {fmtMoney(calculatedNet)}
              </span>
            </span>
            {netMatches && (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <Check className="h-4 w-4" /> matches
              </span>
            )}
            {netDifference !== null && !netMatches && (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" /> differs by {fmtMoney(Math.abs(netDifference))}
              </span>
            )}
            {netDifference === null && (
              <span className="text-gray-500">— no Net in the file; this is what will post.</span>
            )}
          </p>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="text-[13px] font-medium text-red-700/80 transition-colors hover:text-red-700 hover:underline disabled:opacity-40"
        >
          Remove row
        </button>
        <span aria-hidden className="h-4 w-px bg-gray-300" />
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] font-semibold text-gray-700 transition-colors hover:text-gray-900 hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  )
}
