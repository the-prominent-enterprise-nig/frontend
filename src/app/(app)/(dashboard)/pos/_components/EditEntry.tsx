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

/** Ticket #24 follow-up — "Edit entry" on a recorded sale (the client's
 * mockup puts it beside Refund; their comment: "it is not editable"). Clicking
 * it turns the sale's own fields into inputs where they sit on the page — the
 * SI / DR No., the agent, each payment's reference no. — with Save below.
 * The Business Owner and the Sales Admin Clerk; each change is kept in the audit log with what it
 * read before and after. What is posted to the books, stock or an installment account (prices,
 * items, terms, the customer, the date) is not editable: Refund or a void
 * request puts those right. */

interface FormValues {
  docNo: string
  agentId: string
  refs: Record<string, string>
}

const valuesOf = (tx: PosTransaction): FormValues => ({
  docNo: tx.salesInvoiceNumber ?? '',
  agentId: tx.sellingAgent?.id ?? '',
  refs: Object.fromEntries((tx.payments ?? []).map((p) => [p.id, p.referenceNumber ?? ''])),
})

/** The server's message without its machine code ("nothing_changed: …"). */
const readable = (error: string): string => error.replace(/^[a-z_]+:\s*/, '')

/** Only what differs from the sale as recorded; null when nothing does. */
function changesOf(tx: PosTransaction, form: FormValues): EditRecordedSaleInput | null {
  const changes: EditRecordedSaleInput = {}
  if (form.docNo.trim() !== (tx.salesInvoiceNumber ?? ''))
    changes.documentNumber = form.docNo.trim()
  if (form.agentId !== (tx.sellingAgent?.id ?? '')) changes.sellingAgentId = form.agentId || null
  const payments = (tx.payments ?? [])
    .filter((p) => (form.refs[p.id] ?? '').trim() !== (p.referenceNumber ?? ''))
    .map((p) => ({ id: p.id, referenceNumber: (form.refs[p.id] ?? '').trim() || null }))
  if (payments.length > 0) changes.payments = payments
  return Object.keys(changes).length > 0 ? changes : null
}

export type EditEntryForm = ReturnType<typeof useEditEntryForm>

/** The Edit entry state for one sale. `editing` turns the page's fields into
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
  const agentOptions = [
    { value: '', label: 'No agent' },
    // The sale's own agent stays pickable even if no longer active.
    ...(tx.sellingAgent && !agents.data?.data?.some((a) => a.id === tx.sellingAgent!.id)
      ? [{ value: tx.sellingAgent.id, label: tx.sellingAgent.name }]
      : []),
    ...(agents.data?.data ?? []).map((a) => ({ value: a.id, label: a.name })),
  ]

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
    const changes = changesOf(tx, values)
    if (!changes) return setError('Nothing has been changed yet.')
    if (changes.documentNumber === '') {
      return setError(
        `The ${tx.deliveryReceiptNumber ? 'Delivery Receipt' : 'Sales Invoice'} No. can't be blank.`
      )
    }
    setError(null)
    setSaving(true)
    const res = await editRecordedSale(tx.id, changes)
    setSaving(false)
    if (!res.success || !res.data) return setError(readable(res.error ?? 'Failed to save.'))
    queryClient.setQueryData(['pos-transaction', tx.id], res)
    void queryClient.invalidateQueries({ queryKey: ['pos-transactions'] })
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
    setDocNo: (docNo: string) => setValues((v) => ({ ...v, docNo })),
    setAgentId: (agentId: string) => setValues((v) => ({ ...v, agentId })),
    setRef: (paymentId: string, ref: string) =>
      setValues((v) => ({ ...v, refs: { ...v.refs, [paymentId]: ref } })),
    agentOptions,
    agentsLoading: agents.isLoading,
  }
}

export const editInputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-normal text-gray-900 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500'

/** The SI / DR No. as an input, in the Sale card. */
export function DocNoInput({ form, label }: { form: EditEntryForm; label: string }) {
  return (
    <input
      aria-label={label}
      data-testid="edit-entry-doc-no"
      className={editInputClass}
      value={form.values.docNo}
      maxLength={100}
      onChange={(e) => form.setDocNo(e.target.value)}
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
      placeholder="No agent"
      loading={form.agentsLoading}
      ariaLabel="Agent"
    />
  )
}

/** A payment's reference no. as an input, under that payment. */
export function PaymentRefInput({
  form,
  paymentId,
  label,
}: {
  form: EditEntryForm
  paymentId: string
  label: string
}) {
  return (
    <input
      aria-label={label}
      className={`${editInputClass} mt-1 font-mono text-xs normal-case`}
      placeholder="CR # / reference no."
      value={form.values.refs[paymentId] ?? ''}
      maxLength={100}
      onChange={(e) => form.setRef(paymentId, e.target.value)}
    />
  )
}

/** Where Refund / Edit entry sit, while editing: Cancel and Save. */
export function EditEntryBar({ form, card }: { form: EditEntryForm; card: string }) {
  return (
    <div className={`${card} space-y-3`} data-testid="edit-entry-bar">
      <p className="text-xs text-gray-500">
        Only the SI / DR No., agent and reference numbers can be changed.
      </p>
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
