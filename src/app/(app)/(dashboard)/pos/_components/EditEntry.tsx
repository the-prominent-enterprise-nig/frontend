'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, PencilLine } from 'lucide-react'
import type { PosTransaction } from '@/src/schema/pos'
import {
  editRecordedSale,
  getSellingAgents,
  type EditRecordedSaleInput,
} from '../_actions/pos-actions'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { saleDocNo } from '@/src/libs/format/saleDocNo'
import { qrTenderLabel } from '../checkout/_utils/delivery'

/** Ticket #24 follow-up — "Edit entry" on a recorded sale (the client's
 * mockup puts it beside Refund; their comment: "it is not editable"). It opens
 * a pop-up, like Refund, with the sale's SI / DR No., its agent and each
 * payment's reference no., and Save. The Business Owner and the Sales Admin
 * Clerk; each change is kept in the audit log with what it read before and
 * after. What is posted to the books, stock or an installment account
 * (prices, items, terms, the customer, the date) is not editable: Refund or a
 * void request puts those right. */

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

const formatCurrency = (n: number): string =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

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

/** The Edit entry state for one sale, starting from the sale as it now reads
 * (the pop-up mounts fresh each time it opens). */
function useEditEntryForm(tx: PosTransaction, onSaved: () => void) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<FormValues>(() => valuesOf(tx))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // The same active-agent list checkout picks from.
  const agents = useQuery({
    queryKey: ['pos-selling-agents'],
    queryFn: () => getSellingAgents(),
    staleTime: 5 * 60 * 1000,
  })
  const agentOptions = [
    { value: '', label: 'No agent' },
    // The sale's own agent stays pickable even if no longer active.
    ...(tx.sellingAgent && !agents.data?.data?.some((a) => a.id === tx.sellingAgent!.id)
      ? [{ value: tx.sellingAgent.id, label: tx.sellingAgent.name }]
      : []),
    ...(agents.data?.data ?? []).map((a) => ({ value: a.id, label: a.name })),
  ]

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
    onSaved()
  }

  return {
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

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100 disabled:bg-gray-50'

const labelClass = 'mb-1 block text-xs font-semibold text-gray-600'

const paymentName = (p: NonNullable<PosTransaction['payments']>[number]): string =>
  p.paymentMethod === 'qr'
    ? qrTenderLabel(p.paymentMethodOption?.name)
    : p.paymentMethod.replace('_', ' ')

/** The Edit entry pop-up: the SI / DR No., the agent and each payment's
 * reference no., with Cancel and Save changes. */
export function EditEntryModal({
  tx,
  onClose,
}: {
  tx: PosTransaction
  onClose: () => void
}): React.JSX.Element {
  const form = useEditEntryForm(tx, onClose)
  const docLabel = tx.deliveryReceiptNumber ? 'Delivery Receipt No.' : 'Sales Invoice No.'
  const payments = tx.payments ?? []

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={() => !form.saving && onClose()} />
      <div className="fixed inset-0 z-51 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-entry-title"
          className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
        >
          <div className="flex items-center gap-3 px-6 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-prominent-purple-100">
              <PencilLine size={18} className="text-prominent-purple-700" />
            </div>
            <div>
              <h2 id="edit-entry-title" className="text-lg font-bold text-gray-900">
                Edit entry
              </h2>
              <p className="font-mono text-xs text-gray-500">{saleDocNo(tx)}</p>
            </div>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto px-6">
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
              Only the SI / DR No., agent and reference numbers can be changed.
            </p>

            <div>
              <label htmlFor="edit-entry-doc-no" className={labelClass}>
                {docLabel}
              </label>
              <input
                id="edit-entry-doc-no"
                data-testid="edit-entry-doc-no"
                className={inputClass}
                value={form.values.docNo}
                maxLength={100}
                disabled={form.saving}
                onChange={(e) => form.setDocNo(e.target.value)}
              />
            </div>

            <div>
              <p className={labelClass}>Agent</p>
              <SearchableSelect
                value={form.values.agentId}
                onChange={form.setAgentId}
                options={form.agentOptions}
                placeholder="No agent"
                loading={form.agentsLoading}
                disabled={form.saving}
                ariaLabel="Agent"
                // The body scrolls when there are many payments; float the
                // list over it instead of being clipped by it.
                portal
              />
            </div>

            {payments.length > 0 && (
              <div className="space-y-3">
                <p className={labelClass}>Reference no. (CR #)</p>
                {payments.map((p) => (
                  <div key={p.id}>
                    <p className="mb-1 flex justify-between text-xs text-gray-500">
                      <span className="capitalize">{paymentName(p)}</span>
                      <span>{formatCurrency(p.amount)}</span>
                    </p>
                    <input
                      aria-label={`Reference no. for the ${p.paymentMethod.replace('_', ' ')} payment of ${formatCurrency(p.amount)}`}
                      className={`${inputClass} font-mono`}
                      placeholder="CR # / reference no."
                      value={form.values.refs[p.id] ?? ''}
                      maxLength={100}
                      disabled={form.saving}
                      onChange={(e) => form.setRef(p.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            {form.error && (
              <p
                role="alert"
                data-testid="edit-entry-error"
                className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                {form.error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={onClose}
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
        </div>
      </div>
    </>
  )
}
