'use client'

import { useMemo } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { getAccounts } from '@/src/libs/data/AccountingData'
import type { IdmFormValues } from '@/src/schema/accounting/inventory-debit-memos'
import {
  FieldError,
  INPUT,
  Section,
} from '../../../../inventory/delivery-receipts/_components/drFormUi'
import { fmtPeso } from '../../../../inventory/delivery-receipts/_lib/dr-format'

type AccountOption = { id: string; number: string; name: string; isHeader?: boolean }

const GRID =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1.2fr)_130px_130px_32px] md:items-start'

/** Every account, "number — name". GET /accounts returns a bare array even
 * though its client types an envelope — same tolerance as ExpenseForm. */
function useAccountOptions(): CategorySelectOption[] {
  const query = useQuery({
    queryKey: ['coa-all-accounts'],
    queryFn: () => getAccounts({ limit: 1000 }),
    staleTime: 5 * 60_000,
  })
  return useMemo(() => {
    const raw = query.data?.data as AccountOption[] | { items?: AccountOption[] } | undefined
    const list = Array.isArray(raw) ? raw : (raw?.items ?? [])
    return list.map((a) => ({ id: a.id, name: `${a.number} — ${a.name}`, depth: 0 }))
  }, [query.data])
}

/** The memo's Account / Description / Debit / Credit rows, with the
 * totals box from the client's form. */
export function IdmLinesSection({ readOnly }: { readOnly: boolean }): React.JSX.Element {
  const { control, formState } = useFormContext<IdmFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = useWatch({ control, name: 'lines' })
  const accounts = useAccountOptions()
  const debit = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const credit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  const balanced = Math.abs(debit - credit) < 0.01 && debit > 0
  const linesError = formState.errors.lines?.root?.message ?? formState.errors.lines?.message

  return (
    <Section
      title="Entries"
      description="The journal entry this memo posts. Debits and credits must be equal."
    >
      <div
        className={`${GRID} hidden text-[11px] font-medium uppercase tracking-[.06em] text-[#8b8b9b] md:grid`}
      >
        <span>Account</span>
        <span>Description</span>
        <span className="text-right">Debit amount</span>
        <span className="text-right">Credit amount</span>
        <span />
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className={`${GRID} rounded-lg border border-[#eeeef1] p-2 md:border-0 md:p-0`}
        >
          <Controller
            control={control}
            name={`lines.${index}.accountId`}
            render={({ field: f }) => (
              <CategorySelect
                value={f.value || undefined}
                onChange={(v) => f.onChange(v ?? '')}
                options={accounts}
                placeholder="Select account…"
                noun="accounts"
                aria-label="Account"
                disabled={readOnly}
                compact
              />
            )}
          />
          <Controller
            control={control}
            name={`lines.${index}.description`}
            render={({ field: f }) => (
              <input {...f} className={INPUT} placeholder="Description" disabled={readOnly} />
            )}
          />
          <AmountInput index={index} side="debit" readOnly={readOnly} />
          <AmountInput index={index} side="credit" readOnly={readOnly} />
          {!readOnly ? (
            <Tooltip label="Remove line">
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label="Remove line"
                className="flex h-[38px] w-8 items-center justify-center rounded-lg text-[#b42318] hover:bg-[#fdeceb]"
              >
                <X className="h-4 w-4" />
              </button>
            </Tooltip>
          ) : (
            <span />
          )}
          {formState.errors.lines?.[index]?.debit?.message && (
            <div className="md:col-span-5">
              <FieldError text={formState.errors.lines[index]!.debit!.message!} />
            </div>
          )}
        </div>
      ))}
      {linesError && <FieldError text={linesError} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {!readOnly ? (
          <button
            type="button"
            onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0 })}
            className="rounded-lg bg-[#f1ebfb] px-4 py-2 text-[13px] font-medium text-[#3f1490] hover:bg-[#e6dcf8]"
          >
            Add line
          </button>
        ) : (
          <span />
        )}
        <Totals debit={debit} credit={credit} balanced={balanced} />
      </div>
    </Section>
  )
}

/** Typing a debit clears the line's credit and vice versa — a line is one
 * side or the other. */
function AmountInput({
  index,
  side,
  readOnly,
}: {
  index: number
  side: 'debit' | 'credit'
  readOnly: boolean
}): React.JSX.Element {
  const { control, setValue } = useFormContext<IdmFormValues>()
  const other = side === 'debit' ? 'credit' : 'debit'
  return (
    <Controller
      control={control}
      name={`lines.${index}.${side}`}
      render={({ field }) => (
        <input
          type="number"
          min={0}
          step="0.01"
          value={field.value === 0 ? '' : field.value}
          placeholder="0.00"
          disabled={readOnly}
          aria-label={side === 'debit' ? 'Debit amount' : 'Credit amount'}
          onChange={(e) => {
            const v = e.target.value === '' ? 0 : Number(e.target.value)
            field.onChange(v)
            if (v > 0) setValue(`lines.${index}.${other}`, 0)
          }}
          className={`${INPUT} text-right tabular-nums`}
        />
      )}
    />
  )
}

function Totals({
  debit,
  credit,
  balanced,
}: {
  debit: number
  credit: number
  balanced: boolean
}): React.JSX.Element {
  const row = 'flex items-center justify-between gap-8 px-4 py-2.5'
  return (
    <div className="min-w-[280px] overflow-hidden rounded-lg border border-[#e4e4e9] bg-[#fbfbfc] text-[13px]">
      <div className={`${row} border-b border-[#eeeef1]`}>
        <span className="font-semibold">Total debit</span>
        <span className="tabular-nums">{fmtPeso(debit)}</span>
      </div>
      <div className={row}>
        <span className="font-semibold">Total credit</span>
        <span className="tabular-nums">{fmtPeso(credit)}</span>
      </div>
      <div
        className={`${row} border-t border-[#eeeef1] text-[12px] font-medium ${balanced ? 'text-[#0b6644]' : 'text-[#b42318]'}`}
      >
        {balanced
          ? 'Balanced'
          : debit === 0 && credit === 0
            ? 'Enter the amounts'
            : `Off by ${fmtPeso(Math.abs(debit - credit))}`}
      </div>
    </div>
  )
}
