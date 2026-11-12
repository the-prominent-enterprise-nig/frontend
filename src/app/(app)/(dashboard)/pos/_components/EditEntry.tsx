'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { PosTransaction } from '@/src/schema/pos'
import {
  editRecordedSale,
  getSellingAgents,
  type EditRecordedSaleInput,
} from '../_actions/pos-actions'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { manilaDateOf } from '@/src/libs/format/manila-date'

/** Docket #49 — "Edit entry" on a recorded sale. Clicking it turns the Invoice
 * Date, Agent, Credit, Commission and SMI into inputs where they sit in the
 * transaction modal, with Save below. The Business Owner and the Sales Admin
 * Clerk.
 *
 * A saved edit only changes the POS Sales Report: the sale, its installment
 * account, commission, expenses and journal entries stay as recorded. Each
 * change is kept in the audit log with what it read before and after. */

interface FormValues {
  agentId: string
  credit: string
  commission: string
  smi: string
  invoiceDate: string
}

type AmountField = 'credit' | 'commission' | 'smi'

const AMOUNT_LABELS: Record<AmountField, string> = {
  credit: 'Credit',
  commission: 'Commission',
  smi: 'SMI',
}

const AMOUNT_FIELDS = Object.keys(AMOUNT_LABELS) as AmountField[]

const amountText = (n: number | null | undefined): string => (n == null ? '' : String(n))

/** The boxes open on what the Sales Report shows now: an earlier edit, or
 * else what the sale recorded. */
const valuesOf = (tx: PosTransaction): FormValues => {
  const edit = tx.reportEdit
  const account = tx.accountSummary
  return {
    agentId: edit?.agentId ?? tx.sellingAgent?.id ?? '',
    credit: amountText(edit?.credit ?? account?.amountFinanced),
    commission: amountText(
      edit?.commission ?? (account ? account.commission : tx.saleCommission?.commission)
    ),
    smi: amountText(edit?.smi ?? (account ? account.smi : tx.saleCommission?.smi)),
    invoiceDate: edit?.invoiceDate ?? manilaDateOf(tx.occurredAt ?? tx.createdAt),
  }
}

/** The server's message without its machine code ("nothing_changed: …"). */
const readable = (error: string): string => error.replace(/^[a-z_]+:\s*/, '')

const cleanAmount = (text: string): string => text.trim().replace(/,/g, '')

/** The first amount that isn't one, as a message; null when all are fine. */
function amountError(form: FormValues): string | null {
  for (const field of AMOUNT_FIELDS) {
    const text = cleanAmount(form[field])
    if (text && !/^\d+(\.\d{1,2})?$/.test(text)) {
      return `${AMOUNT_LABELS[field]} must be an amount, like 1250.50.`
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
  for (const field of AMOUNT_FIELDS) {
    const text = cleanAmount(form[field])
    if (text !== opened[field]) changes[field] = text ? Number(text) : null
  }
  if (form.invoiceDate !== opened.invoiceDate) changes.invoiceDate = form.invoiceDate || null
  return Object.keys(changes).length > 0 ? changes : null
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
    const invalid = amountError(values)
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

  return {
    editing,
    start,
    cancel,
    save,
    saving,
    error,
    values,
    setAgentId: (agentId: string) => setValues((v) => ({ ...v, agentId })),
    setAmount: (field: AmountField, text: string) => setValues((v) => ({ ...v, [field]: text })),
    setInvoiceDate: (invoiceDate: string) => setValues((v) => ({ ...v, invoiceDate })),
    agentOptions,
    agentsLoading: agents.isLoading,
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

/** Credit, Commission or SMI as an input, in the Agent and credit card. */
export function AmountInput({ form, field }: { form: EditEntryForm; field: AmountField }) {
  return (
    <input
      inputMode="decimal"
      aria-label={AMOUNT_LABELS[field]}
      className={editInputClass}
      value={form.values[field]}
      onChange={(e) => form.setAmount(field, e.target.value)}
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
