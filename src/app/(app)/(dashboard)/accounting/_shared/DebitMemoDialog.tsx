'use client'

import { useState } from 'react'
import { useForm, useWatch, Controller, useFieldArray, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Trash2, X } from 'lucide-react'
import { DebitMemos, type ARInvoice, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import {
  CreateDebitMemoFormSchema,
  type CreateDebitMemoFormValues,
} from '@/src/schema/accounting/debit-memos'
import { ItemSearchCombobox } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_components/ItemSearchCombobox'
import { SerialSearchCombobox } from '@/src/app/(app)/(dashboard)/inventory/transfers/_components/SerialSearchCombobox'
import { getSerialNumbers } from '@/src/app/(app)/(dashboard)/inventory/serial-numbers/_actions/get-serial-numbers'
import { getItem } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item'
import Field from './Field'
import ARInvoiceCombobox from './ARInvoiceCombobox'

/** Extracted verbatim from ARInvoicesList so the Credit/Debit Memo pages can
 * raise a memo directly instead of sending the user to AR Invoices first.
 * Both entry points render this same dialog against the same invoice shape.
 *
 * From an AR invoice row the invoice is given and fixed — it is the row that
 * was clicked. From the memo list nothing is given, and the invoice is the
 * form's first field rather than a modal shown before it. */

const DEBIT_MEMO_TYPE_OPTIONS: { value: CreateDebitMemoFormValues['type']; label: string }[] = [
  { value: 'unit_replacement', label: 'Unit Replacement' },
  { value: 'billing_adjustment', label: 'Billing Adjustment' },
]

function DebitMemoLineRow({
  control,
  index,
  canRemove,
  onRemove,
  itemError,
  quantityError,
  unitPriceError,
}: {
  control: Control<CreateDebitMemoFormValues>
  index: number
  canRemove: boolean
  onRemove: () => void
  itemError?: string
  quantityError?: string
  unitPriceError?: string
}) {
  const selectedItemId = useWatch({ control, name: `lines.${index}.itemId` })

  const itemDetailQuery = useQuery({
    queryKey: ['inventory-item-detail', selectedItemId],
    queryFn: () => getItem(selectedItemId),
    enabled: !!selectedItemId,
    staleTime: 5 * 60 * 1000,
  })
  const isSerialTracked = itemDetailQuery.data?.data?.isSerialTracked ?? false

  // Status-filtered to 'in_stock', the opposite of CreditMemoLineRow's own
  // choice — a debit memo's primary case is handing the customer a NEW
  // replacement unit, not referencing one already sold.
  const serialsQuery = useQuery({
    queryKey: ['debit-memo-serials', selectedItemId],
    queryFn: () => getSerialNumbers({ itemId: selectedItemId, status: 'in_stock', limit: 500 }),
    enabled: isSerialTracked && !!selectedItemId,
    staleTime: 60 * 1000,
  })
  const serialOptions = serialsQuery.data?.data?.data ?? []

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Controller
            name={`lines.${index}.itemId`}
            control={control}
            render={({ field: f }) => (
              <ItemSearchCombobox value={f.value} onChange={f.onChange} error={itemError} />
            )}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="mt-1.5 rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Qty *">
          <Controller
            name={`lines.${index}.quantity`}
            control={control}
            render={({ field: f }) => (
              <input
                {...f}
                type="number"
                min="1"
                step="1"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                onChange={(e) => f.onChange(e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}
          />
          {quantityError && <p className="mt-1 text-xs text-red-600">{quantityError}</p>}
        </Field>
        <Field label="Unit Price *">
          <Controller
            name={`lines.${index}.unitPrice`}
            control={control}
            render={({ field: f }) => (
              <input
                {...f}
                type="number"
                min="0.01"
                step="0.01"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                onChange={(e) => f.onChange(e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}
          />
          {unitPriceError && <p className="mt-1 text-xs text-red-600">{unitPriceError}</p>}
        </Field>
        <Field label="Addition">
          <Controller
            name={`lines.${index}.additionAmount`}
            control={control}
            render={({ field: f }) => (
              <input
                {...f}
                value={f.value ?? ''}
                type="number"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                onChange={(e) => f.onChange(e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}
          />
        </Field>
      </div>

      {isSerialTracked && (
        <Field label="Specific replacement serial (optional)">
          <Controller
            name={`lines.${index}.serialNumberId`}
            control={control}
            render={({ field: f }) => (
              <SerialSearchCombobox
                value={f.value ?? ''}
                onChange={f.onChange}
                options={serialOptions}
                queryKey={`debit-memo-serial-${selectedItemId}`}
                disabled={serialsQuery.isLoading}
                placeholder={serialsQuery.isLoading ? 'Loading serials…' : 'Search serial number…'}
              />
            )}
          />
        </Field>
      )}
    </div>
  )
}

export default function DebitMemoDialog({
  invoice: fixedInvoice,
  onClose,
  onSaved,
}: {
  /** Given when raising from an AR invoice row. Omitted from the memo list,
   * where the invoice is picked in the form. */
  invoice?: ARInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const [picked, setPicked] = useState<ARInvoice | null>(null)
  const invoice = fixedInvoice ?? picked
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateDebitMemoFormValues>({
    resolver: zodResolver(CreateDebitMemoFormSchema),
    defaultValues: {
      type: 'unit_replacement',
      reason: '',
      memoDate: new Date().toISOString().slice(0, 10),
      lines: [{ itemId: '', quantity: 1, unitPrice: 0, serialNumberId: '', additionAmount: 0 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = useWatch({ control, name: 'lines' })
  const total = (lines ?? []).reduce(
    (sum, l) =>
      sum +
      (Number(l?.quantity) || 0) * (Number(l?.unitPrice) || 0) +
      (Number(l?.additionAmount) || 0),
    0
  )
  const newTotal = (invoice?.totalAmount ?? 0) + total
  const linesArrayError =
    typeof errors.lines?.message === 'string' ? errors.lines.message : undefined

  async function handleFormSubmit(data: CreateDebitMemoFormValues) {
    // The invoice lives outside the form (it drives the summary and the API
    // call, not a field), so it is checked here rather than by the schema.
    if (!invoice) {
      setError('Pick the invoice this memo applies to.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await DebitMemos.issue({
      arInvoiceId: invoice.id,
      type: data.type,
      reason: data.reason || undefined,
      memoDate: data.memoDate,
      lines: data.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        serialNumberId: l.serialNumberId || undefined,
        additionAmount: l.additionAmount || undefined,
      })),
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to issue debit memo')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Issue Debit Memo</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="p-5 space-y-3">
          {fixedInvoice ? (
            <div className="text-sm text-gray-600">
              Invoice <span className="font-mono">{fixedInvoice.invoiceNumber}</span> · Current
              total: <span className="font-semibold">{fmtMoney(fixedInvoice.totalAmount)}</span>
            </div>
          ) : (
            <Field label="Invoice *">
              <ARInvoiceCombobox value={picked?.id ?? ''} onChange={setPicked} />
              {picked && (
                <p className="mt-1 text-xs text-gray-500">
                  Current total:{' '}
                  <span className="font-semibold text-gray-700">
                    {fmtMoney(picked.totalAmount)}
                  </span>
                </p>
              )}
            </Field>
          )}

          <Field label="Type *">
            <Controller
              name="type"
              control={control}
              render={({ field: f }) => (
                <select
                  {...f}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  {DEBIT_MEMO_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Line Items *</span>
              <button
                type="button"
                onClick={() =>
                  append({
                    itemId: '',
                    quantity: 1,
                    unitPrice: 0,
                    serialNumberId: '',
                    additionAmount: 0,
                  })
                }
                className="text-xs font-medium text-purple-700 hover:text-purple-900"
              >
                + Add line
              </button>
            </div>
            {fields.map((field, idx) => (
              <DebitMemoLineRow
                key={field.id}
                control={control}
                index={idx}
                canRemove={fields.length > 1}
                onRemove={() => remove(idx)}
                itemError={errors.lines?.[idx]?.itemId?.message}
                quantityError={errors.lines?.[idx]?.quantity?.message}
                unitPriceError={errors.lines?.[idx]?.unitPrice?.message}
              />
            ))}
            {linesArrayError && <p className="text-xs text-red-600">{linesArrayError}</p>}
          </div>

          <div className="text-xs text-gray-500 border-t pt-2">
            Total Debit: <span className="font-semibold text-gray-900">{fmtMoney(total)}</span> ·
            New invoice total: <span className="font-semibold">{fmtMoney(newTotal)}</span>
          </div>

          <Field label="Reason">
            <Controller
              name="reason"
              control={control}
              render={({ field: f }) => (
                <textarea
                  {...f}
                  placeholder="Replacement unit, under-billed fee..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              )}
            />
          </Field>
          <Field label="Memo Date *">
            <Controller
              name="memoDate"
              control={control}
              render={({ field: f }) => (
                <input
                  {...f}
                  type="date"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              )}
            />
            {errors.memoDate && (
              <p className="mt-1 text-xs text-red-600">{errors.memoDate.message}</p>
            )}
          </Field>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-orange-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Issuing...' : 'Issue Debit Memo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
