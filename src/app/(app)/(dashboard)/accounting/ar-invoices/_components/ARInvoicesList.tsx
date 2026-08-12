'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller, useFieldArray, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Send,
  PhilippinePeso,
  ReceiptText,
  FilePlus,
  History,
  AlertTriangle,
  KeyRound,
  X,
  Search,
  User,
  Loader2,
} from 'lucide-react'
import {
  ARInvoices,
  CreditMemos,
  DebitMemos,
  TaxRates,
  type ARInvoice,
  type ARInvoiceCustomerResult,
  type ARPayment,
  type TaxRate,
  type PaymentMethod,
  PAYMENT_METHOD_OPTIONS,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import { validateManagerByPin } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import {
  buildCreateCreditMemoFormSchema,
  type CreateCreditMemoFormValues,
} from '@/src/schema/accounting/credit-memos'
import {
  CreateDebitMemoFormSchema,
  type CreateDebitMemoFormValues,
} from '@/src/schema/accounting/debit-memos'
import { ItemSearchCombobox } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_components/ItemSearchCombobox'
import { SerialSearchCombobox } from '@/src/app/(app)/(dashboard)/inventory/transfers/_components/SerialSearchCombobox'
import { getSerialNumbers } from '@/src/app/(app)/(dashboard)/inventory/serial-numbers/_actions/get-serial-numbers'
import { getItem } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item'
import Tooltip from '@/src/components/ui/Tooltip'

const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PAID: 'bg-emerald-50 text-emerald-700',
}

export default function ARInvoicesList({
  initialCustomerId,
}: {
  initialCustomerId?: string
} = {}) {
  const router = useRouter()
  const [items, setItems] = useState<ARInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ARInvoice | null>(null)
  const [creating, setCreating] = useState(false)
  const [payingFor, setPayingFor] = useState<ARInvoice | null>(null)
  const [creditingFor, setCreditingFor] = useState<ARInvoice | null>(null)
  const [debitingFor, setDebitingFor] = useState<ARInvoice | null>(null)
  const [historyFor, setHistoryFor] = useState<ARInvoice | null>(null)
  const [deletingFor, setDeletingFor] = useState<ARInvoice | null>(null)
  const [customerFilter, setCustomerFilter] = useState<string | undefined>(initialCustomerId)
  // Set directly when a customer is picked via search below; when arriving
  // via initialCustomerId (a link from Customer360) there's no name yet, so
  // the banner below falls back to deriving it from the loaded invoices'
  // own embedded customer field once they load.
  const [customerFilterName, setCustomerFilterName] = useState<string | undefined>()
  // Scenario 23 Gap 4 — search accepts either the invoice's own number or
  // the POS transaction number that produced it (staff arrive with
  // whichever one they have in hand, never both); resolved server-side via
  // ARInvoicesService.findAll()'s structured lookup, not a text match.
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  // Customer search — this screen previously had no way to filter by
  // customer except arriving via a link from Customer360 (initialCustomerId).
  // Scoped to accounting:ar-invoices:read (ARInvoices.searchCustomers), not
  // the CRM customer list — Accountant (accounting:* only) doesn't hold
  // crm:customers:read, which silently broke this before.
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<ARInvoiceCustomerResult[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await ARInvoices.list({
      ...(customerFilter ? { customerId: customerFilter } : {}),
      ...(appliedSearch ? { search: appliedSearch } : {}),
    })
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [customerFilter, appliedSearch])
  useEffect(() => {
    load()
  }, [load])
  // Arrived via initialCustomerId (a Customer360 link) with no name in
  // hand — resolve it directly. Not derived from the loaded invoices: a
  // customer with zero invoices (the exact case Customer360's "View AR
  // Ledger" link must work for) would leave nothing to derive it from.
  useEffect(() => {
    if (!customerFilter || customerFilterName) return
    ARInvoices.getCustomerById(customerFilter).then((res) => {
      const name = res.data?.[0]?.name
      if (name) setCustomerFilterName(name)
    })
  }, [customerFilter, customerFilterName])
  // Auto-search: commits `search` into `appliedSearch` (which actually
  // drives the query, via `load`'s dependency array) 400ms after the user
  // stops typing, instead of requiring an explicit Apply click.
  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])
  // Debounced customer search, same pattern as the POS checkout page's
  // customer picker.
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      setCustomerSearchOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      const res = await ARInvoices.searchCustomers(customerSearch.trim())
      setCustomerResults(res.data ?? [])
      setCustomerSearchOpen(true)
      setSearchingCustomers(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const send = async (id: string) => {
    const res = await ARInvoices.send(id)
    if (!res.success)
      alert(res.message || res.error || 'Send failed — check Account Mapping settings')
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">AR Invoices</h2>
          <p className="text-sm text-gray-500">Customer invoices and receivables.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative min-w-56 flex-1">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Customer</label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-purple-500 focus:outline-none"
              placeholder="Search by name or phone…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
              onFocus={() => customerResults.length > 0 && setCustomerSearchOpen(true)}
            />
            {searchingCustomers && (
              <Loader2
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
              />
            )}
          </div>
          {customerSearchOpen && (
            <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {customerResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">No customers found</p>
              ) : (
                customerResults.map((c) => (
                  <button
                    key={c.id}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onMouseDown={() => {
                      setCustomerFilter(c.id)
                      setCustomerFilterName(c.name)
                      setCustomerSearch('')
                      setCustomerSearchOpen(false)
                    }}
                  >
                    <User size={13} className="shrink-0 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{c.name}</p>
                      {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className="min-w-64 flex-1">
          <label className="mb-1 block text-xs font-semibold text-gray-600">
            Invoice # or Transaction #
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-purple-500 focus:outline-none"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {appliedSearch && (
          <button
            onClick={() => {
              setSearch('')
              setAppliedSearch('')
            }}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>
      {customerFilter && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-800">
          <span>Filtered to {customerFilterName ?? 'this customer'}</span>
          <button
            onClick={() => {
              setCustomerFilter(undefined)
              setCustomerFilterName(undefined)
            }}
            className="font-medium text-purple-700 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Invoice #</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Invoice Date</th>
              <th className="px-3 py-2 text-left">Due Date</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No invoices.
                </td>
              </tr>
            ) : (
              items.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => router.push(`/accounting/ar-invoices/${i.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-2 max-w-40">
                    <span
                      title={i.invoiceNumber}
                      className="block truncate font-mono text-xs text-purple-700"
                    >
                      {i.invoiceNumber}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-40">
                    <span title={i.customer?.name} className="block truncate">
                      {i.customer?.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(i.invoiceDate)}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(i.dueDate)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(i.totalAmount)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(i.amountPaid)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(i.totalAmount - i.amountPaid)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${INVOICE_STATUS_BADGE[i.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <div className="flex items-center gap-0.5">
                        {i.status === 'DRAFT' ? (
                          <Tooltip label="Send">
                            <button
                              onClick={() => send(i.id)}
                              aria-label="Send"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        ) : (
                          ['SENT', 'PARTIAL', 'OVERDUE', 'PAID'].includes(i.status) && (
                            <Tooltip label="Record payment">
                              <button
                                onClick={() => setPayingFor(i)}
                                aria-label="Record payment"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <PhilippinePeso className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          )
                        )}
                        {(i.payments?.length ?? 0) > 0 && (
                          <Tooltip label="Payment history">
                            <button
                              onClick={() => setHistoryFor(i)}
                              aria-label="Payment history"
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        )}
                        {['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status) && (
                          <Tooltip label="Issue credit memo">
                            <button
                              onClick={() => setCreditingFor(i)}
                              aria-label="Issue credit memo"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                            >
                              <ReceiptText className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        )}
                        {['SENT', 'PARTIAL', 'OVERDUE', 'PAID'].includes(i.status) && (
                          <Tooltip label="Issue debit memo">
                            <button
                              onClick={() => setDebitingFor(i)}
                              aria-label="Issue debit memo"
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                            >
                              <FilePlus className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                      <div className="ml-1 flex items-center gap-0.5 border-l border-gray-200 pl-1.5">
                        <Tooltip label="Edit">
                          <button
                            onClick={() => setEditing(i)}
                            aria-label="Edit"
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <button
                            onClick={() => setDeletingFor(i)}
                            aria-label="Delete"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <InvoiceFormDialog
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
      {payingFor && (
        <PaymentDialog
          invoice={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={() => {
            setPayingFor(null)
            load()
          }}
        />
      )}
      {creditingFor && (
        <CreditMemoDialog
          invoice={creditingFor}
          onClose={() => setCreditingFor(null)}
          onSaved={() => {
            setCreditingFor(null)
            load()
          }}
        />
      )}
      {debitingFor && (
        <DebitMemoDialog
          invoice={debitingFor}
          onClose={() => setDebitingFor(null)}
          onSaved={() => {
            setDebitingFor(null)
            load()
          }}
        />
      )}
      {historyFor && (
        <PaymentHistoryModal
          invoice={historyFor}
          onClose={() => setHistoryFor(null)}
          onChanged={load}
        />
      )}
      {deletingFor && (
        <DeleteInvoiceDialog
          invoice={deletingFor}
          onClose={() => setDeletingFor(null)}
          onDeleted={() => {
            setDeletingFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function DeleteInvoiceDialog({
  invoice,
  onClose,
  onDeleted,
}: {
  invoice: ARInvoice
  onClose: () => void
  onDeleted: () => void
}) {
  const [pin, setPin] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) {
      setError('Manager/Owner PIN is required to delete this invoice.')
      return
    }
    setDeleting(true)
    setError(null)
    const pinRes = await validateManagerByPin(pin.trim())
    if (!pinRes.success || !pinRes.data?.valid) {
      setError(pinRes.error ?? 'Invalid PIN. Please try again.')
      setDeleting(false)
      return
    }
    const res = await ARInvoices.remove(invoice.id)
    setDeleting(false)
    if (!res.success) {
      setError(res.message || res.error || 'Delete failed')
      return
    }
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Delete Invoice</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="text-sm text-gray-600 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Delete invoice <span className="font-mono">{invoice.invoiceNumber}</span>? This cannot
              be undone.
            </span>
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound size={13} className="text-purple-600" />
              <p className="text-xs font-semibold text-purple-700">Manager / Owner PIN required</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono tracking-widest text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && submit(e as unknown as React.FormEvent)}
              disabled={deleting}
            />
          </div>
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
              disabled={deleting || !pin.trim()}
              className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const CREDIT_MEMO_TYPE_OPTIONS: { value: CreateCreditMemoFormValues['type']; label: string }[] = [
  { value: 'sales_return', label: 'Sales Return' },
  { value: 'billing_adjustment', label: 'Billing Adjustment' },
  { value: 'goodwill', label: 'Goodwill' },
]

function CreditMemoLineRow({
  control,
  index,
  canRemove,
  onRemove,
  itemError,
  quantityError,
  unitPriceError,
}: {
  control: Control<CreateCreditMemoFormValues>
  index: number
  canRemove: boolean
  onRemove: () => void
  itemError?: string
  quantityError?: string
  unitPriceError?: string
}) {
  const selectedItemId = useWatch({ control, name: `lines.${index}.itemId` })

  // Mirrors CreateTransferModal's TransferLineRow — the serial picker only
  // makes sense once we know the item is serial-tracked at all.
  const itemDetailQuery = useQuery({
    queryKey: ['inventory-item-detail', selectedItemId],
    queryFn: () => getItem(selectedItemId),
    enabled: !!selectedItemId,
    staleTime: 5 * 60 * 1000,
  })
  const isSerialTracked = itemDetailQuery.data?.data?.isSerialTracked ?? false

  // Not status-filtered to 'in_stock' — the whole point here is picking a
  // unit that was already SOLD (and is now being returned/credited), the
  // opposite of what a transfer's source-warehouse picker needs.
  const serialsQuery = useQuery({
    queryKey: ['credit-memo-serials', selectedItemId],
    queryFn: () => getSerialNumbers({ itemId: selectedItemId, limit: 500 }),
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
        <Field label="Deduction">
          <Controller
            name={`lines.${index}.deductionAmount`}
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
        <Field label="Specific serial returned (optional)">
          <Controller
            name={`lines.${index}.serialNumberId`}
            control={control}
            render={({ field: f }) => (
              <SerialSearchCombobox
                value={f.value ?? ''}
                onChange={f.onChange}
                options={serialOptions}
                queryKey={`credit-memo-serial-${selectedItemId}`}
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

function CreditMemoDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: ARInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const outstanding = invoice.totalAmount - invoice.amountPaid
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCreditMemoFormValues>({
    resolver: zodResolver(buildCreateCreditMemoFormSchema(outstanding)),
    defaultValues: {
      type: 'sales_return',
      reason: '',
      memoDate: new Date().toISOString().slice(0, 10),
      lines: [{ itemId: '', quantity: 1, unitPrice: 0, serialNumberId: '', deductionAmount: 0 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = useWatch({ control, name: 'lines' })
  const total = (lines ?? []).reduce(
    (sum, l) =>
      sum +
      (Number(l?.quantity) || 0) * (Number(l?.unitPrice) || 0) -
      (Number(l?.deductionAmount) || 0),
    0
  )
  const remaining = outstanding - total
  const linesArrayError =
    typeof errors.lines?.message === 'string' ? errors.lines.message : undefined

  async function handleFormSubmit(data: CreateCreditMemoFormValues) {
    setSaving(true)
    setError(null)
    const res = await CreditMemos.issue({
      arInvoiceId: invoice.id,
      type: data.type,
      reason: data.reason || undefined,
      memoDate: data.memoDate,
      lines: data.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        serialNumberId: l.serialNumberId || undefined,
        deductionAmount: l.deductionAmount || undefined,
      })),
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to issue credit memo')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Issue Credit Memo</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="p-5 space-y-3">
          <div className="text-sm text-gray-600">
            Invoice <span className="font-mono">{invoice.invoiceNumber}</span> · Outstanding:{' '}
            <span className="font-semibold">{fmtMoney(outstanding)}</span>
          </div>

          <Field label="Type *">
            <Controller
              name="type"
              control={control}
              render={({ field: f }) => (
                <select
                  {...f}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  {CREDIT_MEMO_TYPE_OPTIONS.map((o) => (
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
                    deductionAmount: 0,
                  })
                }
                className="text-xs font-medium text-purple-700 hover:text-purple-900"
              >
                + Add line
              </button>
            </div>
            {fields.map((field, idx) => (
              <CreditMemoLineRow
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
            Total Credit: <span className="font-semibold text-gray-900">{fmtMoney(total)}</span> ·
            Remaining after credit: <span className="font-semibold">{fmtMoney(remaining)}</span>
          </div>

          <Field label="Reason">
            <Controller
              name="reason"
              control={control}
              render={({ field: f }) => (
                <textarea
                  {...f}
                  placeholder="Returns, discount, billing adjustment..."
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
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Issuing...' : 'Issue Credit Memo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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

function DebitMemoDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: ARInvoice
  onClose: () => void
  onSaved: () => void
}) {
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
  const newTotal = invoice.totalAmount + total
  const linesArrayError =
    typeof errors.lines?.message === 'string' ? errors.lines.message : undefined

  async function handleFormSubmit(data: CreateDebitMemoFormValues) {
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
          <div className="text-sm text-gray-600">
            Invoice <span className="font-mono">{invoice.invoiceNumber}</span> · Current total:{' '}
            <span className="font-semibold">{fmtMoney(invoice.totalAmount)}</span>
          </div>

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

function InvoiceFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: ARInvoice | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    customerId: initial?.customerId ?? '',
    invoiceDate: initial?.invoiceDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate:
      initial?.dueDate?.slice(0, 10) ??
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: initial?.description ?? '',
    subtotal: String(initial?.subtotal ?? ''),
    taxAmount: String(initial?.taxAmount ?? ''),
    taxCode: (initial as any)?.taxCode ?? '',
    costCenter: initial?.costCenter ?? '',
  })
  const [saving, setSaving] = useState(false)
  // ACC-21 bridge: load tax rates so users can pick one instead of typing taxAmount manually
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  useEffect(() => {
    TaxRates.list(true).then((r) => setTaxRates(r.data ?? []))
  }, [])

  // Customer picker — search rather than a full-list <select>, and scoped
  // to accounting:ar-invoices:read (see ARInvoices.searchCustomers), so an
  // Accountant without crm:customers:read can still pick one.
  const [customerLabel, setCustomerLabel] = useState(initial?.customer?.name ?? '')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<ARInvoiceCustomerResult[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      setCustomerSearchOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      const res = await ARInvoices.searchCustomers(customerSearch.trim())
      setCustomerResults(res.data ?? [])
      setCustomerSearchOpen(true)
      setSearchingCustomers(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  // When subtotal or tax code changes, recompute tax automatically
  const onTaxCodeChange = (code: string) => {
    const rate = taxRates.find((r) => r.code === code)
    const subtotal = Number(form.subtotal) || 0
    const tax = rate
      ? +(subtotal * (Number(rate.ratePercent) / 100)).toFixed(2)
      : Number(form.taxAmount) || 0
    setForm({ ...form, taxCode: code, taxAmount: rate ? String(tax) : form.taxAmount })
  }
  const onSubtotalChange = (val: string) => {
    const rate = taxRates.find((r) => r.code === form.taxCode)
    const subtotal = Number(val) || 0
    const tax = rate
      ? +(subtotal * (Number(rate.ratePercent) / 100)).toFixed(2)
      : Number(form.taxAmount) || 0
    setForm({ ...form, subtotal: val, taxAmount: rate ? String(tax) : form.taxAmount })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // The customer field is a search box, not a native <select> — its
    // visible text isn't what's submitted, so `required` on the input
    // alone would let a typed-but-never-selected name through with
    // customerId still empty.
    if (!form.customerId) return
    setSaving(true)
    const payload = {
      ...form,
      subtotal: Number(form.subtotal),
      taxAmount: Number(form.taxAmount || 0),
    }
    if (initial) await ARInvoices.update(initial.id, payload)
    else await ARInvoices.create(payload)
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Invoice' : 'New Invoice'}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <Field label="Customer *">
            <div className="relative">
              <input
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-7 text-sm"
                placeholder="Search by name or phone…"
                value={customerLabel || customerSearch}
                onChange={(e) => {
                  setCustomerLabel('')
                  setForm({ ...form, customerId: '' })
                  setCustomerSearch(e.target.value)
                }}
                onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
                onFocus={() => customerResults.length > 0 && setCustomerSearchOpen(true)}
              />
              {searchingCustomers && (
                <Loader2
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                />
              )}
              {customerSearchOpen && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {customerResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">No customers found</p>
                  ) : (
                    customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onMouseDown={() => {
                          setForm({ ...form, customerId: c.id })
                          setCustomerLabel(c.name)
                          setCustomerSearch('')
                          setCustomerSearchOpen(false)
                        }}
                      >
                        <User size={13} className="shrink-0 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice Date *">
              <input
                required
                type="date"
                value={form.invoiceDate}
                onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Due Date *">
              <input
                required
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>
          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Tax Rate">
            <select
              value={form.taxCode}
              onChange={(e) => onTaxCodeChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— None / Manual entry —</option>
              {taxRates.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.code} — {t.name} ({Number(t.ratePercent).toFixed(2)}%)
                </option>
              ))}
            </select>
            {form.taxCode && (
              <p className="mt-1 text-xs text-gray-500">Tax auto-calculates as subtotal × rate.</p>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Subtotal *">
              <input
                required
                type="number"
                step="0.01"
                value={form.subtotal}
                onChange={(e) => onSubtotalChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Tax">
              <input
                type="number"
                step="0.01"
                value={form.taxAmount}
                onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
                disabled={!!form.taxCode}
                className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg ${form.taxCode ? 'bg-gray-50 text-gray-600' : ''}`}
                title={form.taxCode ? 'Auto-calculated from tax rate' : 'Enter tax amount manually'}
              />
            </Field>
            <Field label="Cost Center">
              <input
                value={form.costCenter}
                onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                placeholder="Dept / Project"
              />
            </Field>
          </div>
          <div className="text-right text-sm">
            <span className="text-gray-500">Total: </span>
            <span className="font-semibold text-gray-900">
              {fmtMoney((Number(form.subtotal) || 0) + (Number(form.taxAmount) || 0))}
            </span>
          </div>
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
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaymentDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: ARInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const outstanding = Math.max(invoice.totalAmount - invoice.amountPaid, 0)
  const isClosedAccount = invoice.status === 'PAID'
  const [form, setForm] = useState({
    // outstanding is always a valid non-negative number (Math.max(...) above),
    // so this never needs a `|| ''` fallback — that idiom would blank the
    // field out for a legitimately-zero outstanding balance (0 is falsy).
    amount: String(outstanding),
    withholdingAmount: '0',
    withholdingCertificateNo: '',
    withholdingCertificateStatus: '' as '' | 'pending' | 'received',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'CASH' as PaymentMethod,
    reference: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overpaymentResult, setOverpaymentResult] = useState<{
    overpaidAmount: number
    wasClosedAccount: boolean
  } | null>(null)
  const totalApplied = (Number(form.amount) || 0) + (Number(form.withholdingAmount) || 0)
  const wouldOverpay = totalApplied > outstanding + 0.01

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await ARInvoices.recordPayment(invoice.id, {
      ...form,
      amount: Number(form.amount),
      withholdingAmount: Number(form.withholdingAmount || 0),
      withholdingCertificateNo: form.withholdingCertificateNo || undefined,
      withholdingCertificateStatus: form.withholdingCertificateStatus || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    if (res.data?.overpayment) {
      setOverpaymentResult(res.data.overpayment)
      return
    }
    onSaved()
  }

  if (overpaymentResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              {overpaymentResult.wasClosedAccount
                ? 'Overpayment on a closed account'
                : 'Payment recorded as an overpayment'}
            </h3>
            <p className="text-sm text-gray-600">
              This payment was <span className="font-semibold">not rejected</span> (to keep the
              invoice numbering unbroken), but exceeds what was owed by{' '}
              <span className="font-semibold">{fmtMoney(overpaymentResult.overpaidAmount)}</span>.
              {overpaymentResult.wasClosedAccount &&
                ' The invoice was already fully paid before this payment.'}{' '}
              A manager can cancel this specific payment from the payment history view if needed.
            </p>
            <button
              onClick={onSaved}
              className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Record Payment</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {isClosedAccount && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This invoice is already fully paid. Any amount recorded here will be flagged as a
              closed-account overpayment.
            </div>
          )}
          <div className="text-sm text-gray-600">
            Outstanding: <span className="font-semibold">{fmtMoney(outstanding)}</span>
          </div>
          <Field label="Cash Received *">
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Withholding Tax (if customer withheld)">
            <input
              type="number"
              step="0.01"
              value={form.withholdingAmount}
              onChange={(e) => setForm({ ...form, withholdingAmount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          {Number(form.withholdingAmount) > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="2307 Certificate No.">
                <input
                  type="text"
                  value={form.withholdingCertificateNo}
                  onChange={(e) => setForm({ ...form, withholdingCertificateNo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </Field>
              <Field label="Certificate Status">
                <select
                  value={form.withholdingCertificateStatus}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      withholdingCertificateStatus: e.target.value as '' | 'pending' | 'received',
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">— Not tracked —</option>
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                </select>
              </Field>
            </div>
          )}
          <div className="text-xs text-gray-500">
            Total applied to AR: <span className="font-semibold">{fmtMoney(totalApplied)}</span>
          </div>
          {wouldOverpay && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This exceeds the outstanding balance by {fmtMoney(totalApplied - outstanding)}. It
              will still be recorded and flagged as an overpayment — it will not be rejected.
            </div>
          )}
          <Field label="Payment Date *">
            <input
              required
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Method">
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference">
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
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
              className="px-4 py-2 text-sm font-semibold bg-emerald-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaymentHistoryModal({
  invoice,
  onClose,
  onChanged,
}: {
  invoice: ARInvoice
  onClose: () => void
  onChanged: () => void
}) {
  const [payments, setPayments] = useState<ARPayment[]>(invoice.payments ?? [])
  const [cancelTarget, setCancelTarget] = useState<ARPayment | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">Payment history — {invoice.invoiceNumber}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {payments.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {fmtMoney(p.amount + p.withholdingAmount)}
                        {p.cancelledAt && (
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
                            cancelled
                          </span>
                        )}
                        {p.isOverpayment && !p.cancelledAt && (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            overpayment +{fmtMoney(p.overpaidAmount)}
                            {p.wasClosedAccount ? ' · closed account' : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {fmtDate(p.paymentDate)}
                        {p.method
                          ? ` · ${PAYMENT_METHOD_OPTIONS.find((o) => o.value === p.method)?.label ?? p.method}`
                          : ''}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </div>
                      {p.cancelReason && (
                        <div className="mt-0.5 text-xs text-gray-400">
                          Cancel reason: {p.cancelReason}
                        </div>
                      )}
                    </div>
                    {p.isOverpayment && !p.cancelledAt && (
                      <button
                        onClick={() => setCancelTarget(p)}
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {cancelTarget && (
        <CancelPaymentDialog
          invoiceId={invoice.id}
          payment={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => {
            setPayments((prev) =>
              prev.map((p) =>
                p.id === cancelTarget.id ? { ...p, cancelledAt: new Date().toISOString() } : p
              )
            )
            setCancelTarget(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function CancelPaymentDialog({
  invoiceId,
  payment,
  onClose,
  onCancelled,
}: {
  invoiceId: string
  payment: ARPayment
  onClose: () => void
  onCancelled: () => void
}) {
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) {
      setError('Manager/Owner PIN is required to cancel this payment.')
      return
    }
    setCancelling(true)
    setError(null)
    const pinRes = await validateManagerByPin(pin.trim())
    if (!pinRes.success || !pinRes.data?.valid) {
      setError(pinRes.error ?? 'Invalid PIN. Please try again.')
      setCancelling(false)
      return
    }
    const res = await ARInvoices.cancelPayment(invoiceId, payment.id, reason.trim() || undefined)
    setCancelling(false)
    if (!res.success) {
      setError(res.message || res.error || 'Cancel failed')
      return
    }
    onCancelled()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Cancel Overpayment</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="text-sm text-gray-600">
            Cancel {fmtMoney(payment.amount + payment.withholdingAmount)} recorded on{' '}
            {fmtDate(payment.paymentDate)}?
          </div>
          <Field label="Reason (optional)">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound size={13} className="text-purple-600" />
              <p className="text-xs font-semibold text-purple-700">Manager / Owner PIN required</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono tracking-widest text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={cancelling}
            />
          </div>
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
              Back
            </button>
            <button
              type="submit"
              disabled={cancelling || !pin.trim()}
              className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
