'use client'

import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MoneyInput from '@/src/components/ui/MoneyInput'
import {
  QuotaGridFormSchema,
  type QuotaGridForm,
  type QuotaTarget,
  type SalesQuotaYear,
} from '@/src/schema/pos/sales-quotas'
import {
  MONTH_LABELS,
  applyPaste,
  changedEntries,
  parsePastedBlock,
  rowTotal,
  sumRows,
  toFormCells,
  type QuotaEntry,
} from './quota-grid'

/**
 * Scenario 85 Part 4 — one year's quotas: branches × 12 months, then the
 * non-branch lines. "Total Branches" sums the branches only and "Grand Total"
 * adds the lines — the same two rows the Branch Scorecard ends on. Saving
 * sends only the cells that changed; clearing a cell removes its quota.
 */

function money(n: number | null): string {
  return n === null
    ? ''
    : n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function QuotaGrid({
  data,
  onSave,
}: {
  data: SalesQuotaYear
  onSave: (entries: QuotaEntry[]) => Promise<boolean>
}): React.JSX.Element {
  const loaded = useMemo(() => toFormCells(data), [data])
  const form = useForm<QuotaGridForm>({
    resolver: zodResolver(QuotaGridFormSchema),
    defaultValues: { cells: loaded },
  })
  const [saving, setSaving] = useState(false)
  const cells = useWatch({ control: form.control, name: 'cells' })
  const changes = changedEntries(loaded, cells)

  const branches = data.targets.filter((t) => t.kind === 'branch')
  const lines = data.targets.filter((t) => t.kind === 'line')
  const rowKeys = [...branches, ...lines].map((t) => t.key)

  function paste(row: number, month: number, text: string): boolean {
    if (!/[\t\n]/.test(text.trim())) return false
    const next = applyPaste(
      form.getValues('cells'),
      rowKeys,
      { row, month },
      parsePastedBlock(text)
    )
    form.setValue('cells', next, { shouldDirty: true })
    return true
  }

  const submit = form.handleSubmit(async () => {
    setSaving(true)
    const ok = await onSave(changes)
    setSaving(false)
    if (ok) form.reset({ cells: form.getValues('cells') })
  })

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">
          {changes.length
            ? `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}`
            : `${data.year} quotas — no unsaved changes`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!changes.length || saving}
            onClick={() => form.reset({ cells: loaded })}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Discard changes
          </button>
          <button
            type="submit"
            disabled={!changes.length || saving}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save quotas'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-max text-xs">
          <thead className="bg-zinc-50 text-[11px] tracking-wide text-zinc-500 uppercase">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left">
                Branch
              </th>
              {MONTH_LABELS.map((m) => (
                <th key={m} scope="col" className="px-2 py-2 text-right">
                  {m}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right">
                Year
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {branches.map((t, r) => (
              <QuotaRow
                key={t.key}
                target={t}
                row={r}
                control={form.control}
                cells={cells[t.key]}
                onPaste={paste}
              />
            ))}
            <TotalRow label="Total Branches" rows={branches.map((t) => cells[t.key])} />
            {lines.map((t, i) => (
              <QuotaRow
                key={t.key}
                target={t}
                row={branches.length + i}
                control={form.control}
                cells={cells[t.key]}
                onPaste={paste}
              />
            ))}
            <TotalRow label="Grand Total" rows={rowKeys.map((k) => cells[k])} strong />
          </tbody>
        </table>
      </div>
      {branches.length === 0 && (
        <p className="text-sm text-zinc-500">No active branches to set quotas for.</p>
      )}
    </form>
  )
}

function QuotaRow({
  target,
  row,
  control,
  cells,
  onPaste,
}: {
  target: QuotaTarget
  row: number
  control: Control<QuotaGridForm>
  cells: string[]
  onPaste: (row: number, month: number, text: string) => boolean
}): React.JSX.Element {
  return (
    <tr className={target.kind === 'line' ? 'bg-prominent-purple-50/40' : 'hover:bg-zinc-50'}>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-medium whitespace-nowrap text-zinc-900"
      >
        {target.name}
        {target.region && (
          <span className="ml-1.5 text-[11px] font-normal text-zinc-500 capitalize">
            {target.region}
          </span>
        )}
      </th>
      {MONTH_LABELS.map((m, month) => (
        <td key={m} className="px-1 py-1">
          <span
            onPasteCapture={(e) => {
              if (onPaste(row, month, e.clipboardData.getData('text'))) e.preventDefault()
            }}
          >
            <Controller
              control={control}
              name={`cells.${target.key}.${month}`}
              render={({ field }) => (
                <MoneyInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  aria-label={`${target.name} ${m}`}
                  className="w-28 rounded-md border border-zinc-200 px-2 py-1.5 text-right text-xs tabular-nums focus:border-prominent-purple-500 focus:outline-none"
                />
              )}
            />
          </span>
        </td>
      ))}
      <td className="px-3 py-1.5 text-right font-semibold text-zinc-900 tabular-nums">
        {money(rowTotal(cells ?? []))}
      </td>
    </tr>
  )
}

function TotalRow({
  label,
  rows,
  strong = false,
}: {
  label: string
  rows: string[][]
  strong?: boolean
}): React.JSX.Element {
  const months = sumRows(rows.filter(Boolean))
  const year = rowTotal(months.map((m) => (m === null ? '' : String(m))))
  return (
    <tr className={strong ? 'border-t-2 border-zinc-300 bg-zinc-100' : 'bg-zinc-50'}>
      <th
        scope="row"
        className={`sticky left-0 z-10 px-3 py-2 text-left font-semibold text-zinc-900 ${strong ? 'bg-zinc-100' : 'bg-zinc-50'}`}
      >
        {label}
      </th>
      {months.map((m, i) => (
        <td
          key={MONTH_LABELS[i]}
          className="px-3 py-2 text-right font-semibold text-zinc-900 tabular-nums"
        >
          {money(m)}
        </td>
      ))}
      <td className="px-3 py-2 text-right font-semibold text-zinc-900 tabular-nums">
        {money(year)}
      </td>
    </tr>
  )
}
