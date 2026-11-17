'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { PosTransaction } from '@/src/schema/pos'
import {
  editRecordedSale,
  getPosPriceUseTypes,
  getSellingAgents,
  type EditRecordedSaleInput,
  type EditRecordedSaleLineInput,
} from '../_actions/pos-actions'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { manilaDateOf } from '@/src/libs/format/manila-date'

/** Docket #49 — "Edit entry" on a recorded sale. Clicking it turns the Invoice
 * Date and Agent into inputs where they sit in the transaction modal, and each
 * item row's Price Used, Credit, CM and SMI into inputs in the Items table
 * (client, Nov 16). The card's Total Credit, Total Commission and Total SMI
 * are the sum of the rows, worked out as they are typed. Save below. The
 * Business Owner and the Sales Admin Clerk.
 *
 * A saved edit only changes the POS Sales Report: the sale, its installment
 * account, commission, expenses and journal entries stay as recorded. Each
 * change is kept in the audit log with what it read before and after. */

/** One item row's boxes. */
interface LineValues {
  priceUseTypeId: string
  credit: string
  commission: string
  smi: string
}

interface FormValues {
  agentId: string
  invoiceDate: string
  /** Keyed by the sale line's id. */
  lines: Record<string, LineValues>
}

export type AmountField = 'credit' | 'commission' | 'smi'

const AMOUNT_LABELS: Record<AmountField, string> = {
  credit: 'Credit',
  commission: 'Commission',
  smi: 'SMI',
}

const AMOUNT_FIELDS = Object.keys(AMOUNT_LABELS) as AmountField[]

const round2 = (n: number): number => Math.round(n * 100) / 100

/** What an edit put in a box: kept as typed, a zero included. */
const editedText = (n: number | null | undefined): string => (n == null ? '' : String(n))

/** What the sale recorded for a row: nothing, or a zero, is an empty box. */
const recordedText = (n: number | null | undefined): string => (n ? String(n) : '')

/** The boxes open on what the Sales Report shows now: an earlier edit, or
 * else what the sale recorded. */
const valuesOf = (tx: PosTransaction): FormValues => {
  const edit = tx.reportEdit
  const figures = tx.lineFigures
  const legacyCredit = tx.accountSummary?.lineCredits
  const lines: Record<string, LineValues> = {}
  for (const l of tx.lines ?? []) {
    const own = edit?.lines?.[l.id]
    lines[l.id] = {
      priceUseTypeId: own?.priceUseTypeId ?? l.priceUseTypeId ?? '',
      credit:
        own?.credit != null
          ? editedText(own.credit)
          : recordedText(figures?.credits?.[l.id] ?? legacyCredit?.[l.id]),
      commission:
        own?.commission != null
          ? editedText(own.commission)
          : recordedText(figures?.commissions?.[l.id]),
      smi: own?.smi != null ? editedText(own.smi) : recordedText(figures?.smis?.[l.id]),
    }
  }
  return {
    agentId: edit?.agentId ?? tx.sellingAgent?.id ?? '',
    invoiceDate: edit?.invoiceDate ?? manilaDateOf(tx.occurredAt ?? tx.createdAt),
    lines,
  }
}

/** The server's message without its machine code ("nothing_changed: …"). */
const readable = (error: string): string => error.replace(/^[a-z_]+:\s*/, '')

const cleanAmount = (text: string): string => text.trim().replace(/,/g, '')

/** The first amount that isn't one, as a message; null when all are fine. */
function amountError(tx: PosTransaction, form: FormValues): string | null {
  const rows = tx.lines ?? []
  for (const [i, l] of rows.entries()) {
    for (const field of AMOUNT_FIELDS) {
      const text = cleanAmount(form.lines[l.id]?.[field] ?? '')
      if (text && !/^\d+(\.\d{1,2})?$/.test(text)) {
        const where = rows.length > 1 ? ` (item ${i + 1})` : ''
        return `${AMOUNT_LABELS[field]} must be an amount, like 1250.50${where}.`
      }
    }
  }
  return null
}

/** Only what differs from when the boxes opened; null when nothing does. A
 * box left empty takes that edit back off. */
function changesOf(tx: PosTransaction, form: FormValues): EditRecordedSaleInput | null {
  const opened = valuesOf(tx)
  const changes: EditRecordedSaleInput = {}
  if (form.agentId !== opened.agentId) changes.sellingAgentId = form.agentId || null
  if (form.invoiceDate !== opened.invoiceDate) changes.invoiceDate = form.invoiceDate || null

  const lines: EditRecordedSaleLineInput[] = []
  for (const l of tx.lines ?? []) {
    const now = form.lines[l.id]
    const was = opened.lines[l.id]
    if (!now || !was) continue
    const row: EditRecordedSaleLineInput = { lineId: l.id }
    if (now.priceUseTypeId !== was.priceUseTypeId) row.priceUseTypeId = now.priceUseTypeId || null
    for (const field of AMOUNT_FIELDS) {
      const text = cleanAmount(now[field])
      if (text !== was[field]) row[field] = text ? Number(text) : null
    }
    if (Object.keys(row).length > 1) lines.push(row)
  }
  if (lines.length > 0) changes.lines = lines
  return Object.keys(changes).length > 0 ? changes : null
}

/** The Items table's columns added up, as typed: the card's three totals. */
function totalsOf(form: FormValues): Record<AmountField, number> {
  const totals: Record<AmountField, number> = { credit: 0, commission: 0, smi: 0 }
  for (const row of Object.values(form.lines)) {
    for (const field of AMOUNT_FIELDS) {
      const n = Number(cleanAmount(row[field]))
      if (Number.isFinite(n)) totals[field] += n
    }
  }
  return {
    credit: round2(totals.credit),
    commission: round2(totals.commission),
    smi: round2(totals.smi),
  }
}

export type EditEntryForm = ReturnType<typeof useEditEntryForm>

/** The Edit entry state for one sale. `editing` turns the modal's fields into
 * inputs; `start` opens them on the sale as it now reads. */
export function useEditEntryForm(tx: PosTransaction) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<FormValues>(() => valuesOf(tx))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // The same active-agent list checkout picks from, fetched once editing.
  const agents = useQuery({
    queryKey: ['pos-selling-agents'],
    queryFn: () => getSellingAgents(),
    staleTime: 5 * 60 * 1000,
    enabled: editing,
  })
  const active = agents.data?.data ?? []
  const inactive = [
    // The sale's own agent, and one picked earlier, stay pickable even if no
    // longer active.
    tx.sellingAgent,
    tx.reportEdit?.agentId
      ? { id: tx.reportEdit.agentId, name: tx.reportEdit.agentName ?? '' }
      : null,
  ].filter((a, i, all): a is { id: string; name: string } => {
    if (!a || active.some((b) => b.id === a.id)) return false
    return all.findIndex((b) => b?.id === a.id) === i
  })
  const agentOptions = [...inactive, ...active].map((a) => ({ value: a.id, label: a.name }))

  // The Price Used list checkout picks from. A row's own Price Used (and one
  // picked earlier) stays pickable even if it is no longer on offer.
  const priceUses = useQuery({
    queryKey: ['pos-price-use-types'],
    queryFn: () => getPosPriceUseTypes(),
    staleTime: 5 * 60 * 1000,
    enabled: editing,
  })
  const priceUseById = new Map((priceUses.data?.data ?? []).map((p) => [p.id, p.name]))
  for (const l of tx.lines ?? []) {
    if (l.priceUseTypeId && l.priceUseName) priceUseById.set(l.priceUseTypeId, l.priceUseName)
  }
  for (const own of Object.values(tx.reportEdit?.lines ?? {})) {
    if (own.priceUseTypeId && own.priceUseName)
      priceUseById.set(own.priceUseTypeId, own.priceUseName)
  }
  const priceUseOptions = [...priceUseById].map(([value, label]) => ({ value, label }))

  const start = (): void => {
    setValues(valuesOf(tx))
    setError(null)
    setEditing(true)
  }
  const cancel = (): void => {
    setEditing(false)
    setError(null)
  }

  const save = async (): Promise<void> => {
    const invalid = amountError(tx, values)
    if (invalid) return setError(invalid)
    const changes = changesOf(tx, values)
    if (!changes) return setError('Nothing has been changed yet.')
    setError(null)
    setSaving(true)
    const res = await editRecordedSale(tx.id, changes)
    setSaving(false)
    if (!res.success || !res.data) return setError(readable(res.error ?? 'Failed to save.'))
    queryClient.setQueryData(['pos-transaction', tx.id], res)
    void queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey[0]).startsWith('pos-sales-report'),
    })
    showToast({ title: 'Entry updated', status: 'success' })
    setEditing(false)
  }

  const setLine = (lineId: string, patch: Partial<LineValues>): void =>
    setValues((v) => ({ ...v, lines: { ...v.lines, [lineId]: { ...v.lines[lineId], ...patch } } }))

  return {
    editing,
    start,
    cancel,
    save,
    saving,
    error,
    values,
    /** Total Credit, Total Commission and Total SMI: the rows, added up. */
    totals: totalsOf(values),
    setAgentId: (agentId: string) => setValues((v) => ({ ...v, agentId })),
    setInvoiceDate: (invoiceDate: string) => setValues((v) => ({ ...v, invoiceDate })),
    setLineAmount: (lineId: string, field: AmountField, text: string) =>
      setLine(lineId, { [field]: text }),
    setLinePriceUse: (lineId: string, priceUseTypeId: string) =>
      setLine(lineId, { priceUseTypeId }),
    agentOptions,
    agentsLoading: agents.isLoading,
    priceUseOptions,
    priceUsesLoading: priceUses.isLoading,
  }
}

export const editInputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-normal text-gray-900 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500'

/** The Invoice Date as an input, in the Sale card. */
export function InvoiceDateInput({ form }: { form: EditEntryForm }) {
  return (
    <input
      type="date"
      aria-label="Invoice Date"
      data-testid="edit-entry-invoice-date"
      className={editInputClass}
      value={form.values.invoiceDate}
      onChange={(e) => form.setInvoiceDate(e.target.value)}
    />
  )
}

/** One item row's Credit, CM or SMI as an input, in the Items table. `row` is
 * the item's 1-based place in the table, so each box has its own name. */
export function LineAmountInput({
  form,
  lineId,
  row,
  field,
  label,
}: {
  form: EditEntryForm
  lineId: string
  row: number
  field: AmountField
  /** The column's heading, as the table shows it ("CM" for Commission). */
  label: string
}) {
  return (
    <input
      inputMode="decimal"
      aria-label={`${label} (item ${row})`}
      data-testid={`edit-line-${field}`}
      className={editInputClass}
      value={form.values.lines[lineId]?.[field] ?? ''}
      onChange={(e) => form.setLineAmount(lineId, field, e.target.value)}
    />
  )
}

/** One item row's Price Used as a picker, in the Items table. */
export function LinePriceUseInput({
  form,
  lineId,
  row,
}: {
  form: EditEntryForm
  lineId: string
  row: number
}) {
  return (
    <SearchableSelect
      value={form.values.lines[lineId]?.priceUseTypeId ?? ''}
      onChange={(id) => form.setLinePriceUse(lineId, id)}
      options={form.priceUseOptions}
      placeholder="Price used"
      loading={form.priceUsesLoading}
      ariaLabel={`Price Used (item ${row})`}
      // The transaction modal scrolls; float the list over it rather than be clipped.
      portal
    />
  )
}

/** The agent as a picker, in the Agent card. */
export function AgentInput({ form }: { form: EditEntryForm }) {
  return (
    <SearchableSelect
      value={form.values.agentId}
      onChange={form.setAgentId}
      options={form.agentOptions}
      placeholder="Select an agent"
      loading={form.agentsLoading}
      ariaLabel="Agent"
      // The transaction modal scrolls; float the list over it rather than be clipped.
      portal
    />
  )
}

/** Where Refund / Edit entry sit, while editing: Cancel and Save. */
export function EditEntryBar({ form, card }: { form: EditEntryForm; card: string }) {
  return (
    <div className={`${card} space-y-3`} data-testid="edit-entry-bar">
      <p className="text-xs text-gray-500">These changes only show in the POS Sales Report.</p>
      {form.error && (
        <p role="alert" data-testid="edit-entry-error" className="text-sm text-red-600">
          {form.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={form.cancel}
          disabled={form.saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={() => void form.save()}
          disabled={form.saving}
          className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
        >
          {form.saving ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Saving…
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </div>
  )
}
