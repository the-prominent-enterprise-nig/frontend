'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, PackageCheck, AlertTriangle, Wrench } from 'lucide-react'
import { CreateReturnFormSchema, CreateReturnFormValues } from '@/src/schema/inventory/returns'
import { getCustomerPurchases } from '../_actions/get-customer-purchases'
import ARInvoiceCombobox from '@/src/app/(app)/(dashboard)/accounting/_shared/ARInvoiceCombobox'
import {
  ItemSearchCombobox,
  type ItemSearchMeta,
} from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_components/ItemSearchCombobox'
import { getSerialNumbers } from '@/src/app/(app)/(dashboard)/inventory/serial-numbers/_actions/get-serial-numbers'
import { CustomerSearchCombobox } from '@/src/app/(app)/(dashboard)/pos/service-jobs/_components/CustomerSearchCombobox'
import type { ApiResponse } from '@/src/libs/api/client'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateReturnFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouseOptions: WarehouseSummary[]
  serialOptions: SerialNumberSummary[]
}

export default function CreateReturnModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouseOptions,
  serialOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateReturnFormValues>({
    resolver: zodResolver(CreateReturnFormSchema),
    defaultValues: {
      itemId: '',
      warehouseId: '',
      quantity: undefined,
      condition: 'sellable',
      notes: '',
      serialNumberId: '',
      repairDecision: undefined,
      arInvoiceId: '',
      customerId: '',
    },
  })

  const condition = watch('condition')
  const repairDecision = watch('repairDecision')
  const selectedItemId = watch('itemId')
  const arInvoiceId = watch('arInvoiceId')
  const customerId = watch('customerId')
  const [invoiceCustomerName, setInvoiceCustomerName] = useState<string | null>(null)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
  /** Escape hatch: the unit being returned isn't always on the customer's own
   *  record (a gift, a walk-in with no history, a pre-migration sale). */
  const [browseCatalogue, setBrowseCatalogue] = useState(false)

  const purchasesQuery = useQuery({
    queryKey: ['return-customer-purchases', customerId],
    queryFn: () => getCustomerPurchases(customerId as string),
    enabled: !!customerId,
    staleTime: 60 * 1000,
  })
  const purchases = purchasesQuery.data?.data ?? []
  /** Only known for the catalogue path — a unit picked from the customer's
   *  purchases already carries its own serial, if it has one. */
  const [catalogueItemIsSerialTracked, setCatalogueItemIsSerialTracked] = useState(false)

  // The units that could actually come back are the ones that went out, so
  // this asks for `sold` — not the in-stock list the repair picker used to
  // filter, which by definition never contains the unit being returned.
  const soldSerialsQuery = useQuery({
    queryKey: ['return-item-sold-serials', selectedItemId],
    queryFn: () => getSerialNumbers({ itemId: selectedItemId, status: 'sold', limit: 100 }),
    enabled: !!selectedItemId,
    staleTime: 60 * 1000,
  })
  const selectedPurchase = purchases.find((p) => p.id === selectedPurchaseId) ?? null
  const showPurchasePicker = !!customerId && !browseCatalogue && purchases.length > 0

  // A unit taken in for repair stays the customer's property — it is never
  // added to stock and never credited — so there is nothing an invoice could
  // do here, and offering the field would promise a credit that never comes.
  const isCustodialRepairIntake = repairDecision === 'flag_for_repair'

  const itemSerials = useMemo(
    () => serialOptions.filter((s) => s.item?.id === selectedItemId),
    [serialOptions, selectedItemId]
  )
  const soldSerials = soldSerialsQuery.data?.data?.data ?? []
  /** Sold units first; the in-stock list is only a fallback for an item whose
   *  sale history predates serial tracking. */
  const serialChoices = soldSerials.length > 0 ? soldSerials : itemSerials

  const isRepairIntake = repairDecision === 'flag_for_repair'
  // A serial-tracked unit returned through the catalogue used to record no
  // serial at all — the picker only ever appeared for a repair.
  const showSerialPicker = isRepairIntake || (catalogueItemIsSerialTracked && !selectedPurchase)

  useEffect(() => {
    if (!isOpen) {
      reset()
      setInvoiceCustomerName(null)
      setSelectedPurchaseId('')
      setBrowseCatalogue(false)
      setCatalogueItemIsSerialTracked(false)
    }
  }, [isOpen, reset])

  useEffect(() => {
    if (repairDecision === 'flag_for_repair' && itemSerials.length === 1) {
      setValue('serialNumberId', itemSerials[0].id)
    }
  }, [repairDecision, itemSerials, setValue])

  if (!isOpen) return null

  /** One pick settles the item, the exact unit, what it sold for and the
   *  invoice it sold on — the whole reason for asking who the customer is
   *  before asking what came back. */
  function handlePurchasePick(purchaseId: string) {
    setSelectedPurchaseId(purchaseId)
    const purchase = purchases.find((p) => p.id === purchaseId)
    setValue('itemId', purchase?.itemId ?? '')
    setValue('serialNumberId', purchase?.serialNumberId ?? '')
    setValue('arInvoiceId', purchase?.arInvoiceId ?? '')
    if (purchase) setValue('quantity', purchase.quantity)
  }

  /** Changing who returned it invalidates everything derived from them. */
  function handleCustomerChange(id: string, onChange: (v: string) => void) {
    onChange(id)
    setSelectedPurchaseId('')
    setBrowseCatalogue(false)
    setCatalogueItemIsSerialTracked(false)
    setValue('itemId', '')
    setValue('serialNumberId', '')
    setValue('arInvoiceId', '')
  }

  async function handleFormSubmit(data: CreateReturnFormValues) {
    const result = await onSubmit({
      ...data,
      notes: data.notes || undefined,
      arInvoiceId: isCustodialRepairIntake ? undefined : data.arInvoiceId || undefined,
      // Kept for a repair intake too — it is the custody record the UDS is
      // built from, not just the credit-memo counterparty.
      customerId: data.customerId || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex bg-white">
      <div className="flex h-full w-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Process Return</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Restock returned items and update stock balance immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="mx-auto grid w-full max-w-4xl flex-1 content-start gap-x-6 gap-y-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
            {/* Customer — who the stock actually came back from. Worth
                recording even with no invoice and no credit: without it a
                return is an anonymous quantity, and a unit taken in for
                repair has no custody trail at all. */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Customer
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  {isCustodialRepairIntake ? '(whose unit this is)' : '(optional)'}
                </span>
              </label>
              {invoiceCustomerName ? (
                <div className="flex h-9.5 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                  {invoiceCustomerName}
                </div>
              ) : (
                <Controller
                  name="customerId"
                  control={control}
                  render={({ field }) => (
                    <CustomerSearchCombobox
                      value={field.value ?? ''}
                      onChange={(id) => handleCustomerChange(id, field.onChange)}
                    />
                  )}
                />
              )}
              {invoiceCustomerName && (
                <p className="mt-1 text-xs text-zinc-400">Taken from the selected invoice.</p>
              )}
            </div>

            {/* Branch */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Return to Branch <span className="text-red-500">*</span>
              </label>
              <Controller
                name="warehouseId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">Select branch…</option>
                    {warehouseOptions.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.branch?.name ?? w.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.warehouseId && (
                <p className="mt-1 text-xs text-red-600">{errors.warehouseId.message}</p>
              )}
            </div>

            {/* Item — picked from the customer's own purchases where we know
                them, so the unit, its serial, its price and its invoice all
                come from one choice. Falls back to the catalogue otherwise. */}
            <div className="md:col-span-2">
              <div className="mb-1 flex items-baseline justify-between">
                <label className="block text-sm font-medium text-zinc-700">
                  {showPurchasePicker ? 'Returned unit' : 'Item'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                {!!customerId && purchases.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBrowseCatalogue(!browseCatalogue)
                      setSelectedPurchaseId('')
                      setValue('itemId', '')
                    }}
                    className="text-xs font-medium text-prominent-purple-700 hover:underline"
                  >
                    {browseCatalogue ? 'Pick from their purchases' : 'Search all items instead'}
                  </button>
                )}
              </div>

              {showPurchasePicker ? (
                <>
                  <select
                    value={selectedPurchaseId}
                    onChange={(e) => handlePurchasePick(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">Select from their purchases…</option>
                    {purchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.itemName ?? p.itemSku ?? 'Item'}
                        {p.serialNumber ? ` · ${p.serialNumber}` : ''} · {p.transactionNumber}
                      </option>
                    ))}
                  </select>
                  {selectedPurchase && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-zinc-400">SKU</dt>
                        <dd className="font-mono text-zinc-700">
                          {selectedPurchase.itemSku ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">Serial</dt>
                        <dd className="font-mono text-zinc-700">
                          {selectedPurchase.serialNumber ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">Sold for</dt>
                        <dd className="text-zinc-700">
                          {selectedPurchase.unitPrice.toLocaleString('en-PH', {
                            style: 'currency',
                            currency: 'PHP',
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">Sold on</dt>
                        <dd className="text-zinc-700">
                          {new Date(selectedPurchase.occurredAt).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </dd>
                      </div>
                    </dl>
                  )}
                </>
              ) : (
                <Controller
                  name="itemId"
                  control={control}
                  render={({ field }) => (
                    <ItemSearchCombobox
                      value={field.value}
                      onChange={field.onChange}
                      onSelect={(option) =>
                        setCatalogueItemIsSerialTracked(
                          !!(option.meta as ItemSearchMeta | undefined)?.isSerialTracked
                        )
                      }
                      error={errors.itemId?.message}
                    />
                  )}
                />
              )}

              {!!customerId && purchasesQuery.isLoading && (
                <p className="mt-1 text-xs text-zinc-400">Loading their purchases…</p>
              )}
              {!!customerId && !purchasesQuery.isLoading && purchases.length === 0 && (
                <p className="mt-1 text-xs text-zinc-400">
                  No recorded purchases for this customer — search the catalogue instead.
                </p>
              )}
              {showPurchasePicker && errors.itemId && (
                <p className="mt-1 text-xs text-red-600">{errors.itemId.message}</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Quantity <span className="text-red-500">*</span>
              </label>
              <Controller
                name="quantity"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  />
                )}
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
              )}
            </div>

            {/* Original Invoice — the customer-side half of the return */}
            {!isCustodialRepairIntake && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Original Invoice
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                {selectedPurchase ? (
                  <div className="flex h-[38px] items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                    {selectedPurchase.arInvoiceNumber ??
                      `${selectedPurchase.transactionNumber} — cash sale, no invoice`}
                  </div>
                ) : (
                  <Controller
                    name="arInvoiceId"
                    control={control}
                    render={({ field }) => (
                      <ARInvoiceCombobox
                        value={field.value ?? ''}
                        requireOutstanding
                        onChange={(invoice) => {
                          field.onChange(invoice?.id ?? '')
                          setValue('customerId', invoice?.customer?.id ?? invoice?.customerId ?? '')
                          setInvoiceCustomerName(invoice?.customer?.name ?? null)
                        }}
                      />
                    )}
                  />
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  {selectedPurchase && !selectedPurchase.arInvoiceId
                    ? 'That sale was settled at the till, so there is no invoice to credit — the stock movement is recorded on its own.'
                    : arInvoiceId
                      ? 'A sales-return credit memo will be issued against this invoice and its balance reduced.'
                      : 'Leave blank to record the stock movement only — the customer will not be credited automatically.'}
                </p>
              </div>
            )}

            {/* Condition */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Condition upon inspection <span className="text-red-500">*</span>
              </label>
              <Controller
                name="condition"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => field.onChange('sellable')}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        field.value === 'sellable'
                          ? 'border-green-500 bg-green-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <PackageCheck
                        className={`h-5 w-5 ${
                          field.value === 'sellable' ? 'text-green-600' : 'text-zinc-400'
                        }`}
                      />
                      <div className="text-center">
                        <p
                          className={`text-sm font-semibold ${
                            field.value === 'sellable' ? 'text-green-700' : 'text-zinc-700'
                          }`}
                        >
                          Sellable
                        </p>
                        <p className="text-xs text-zinc-500">Returns to available stock</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange('damaged')}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        field.value === 'damaged'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-5 w-5 ${
                          field.value === 'damaged' ? 'text-orange-600' : 'text-zinc-400'
                        }`}
                      />
                      <div className="text-center">
                        <p
                          className={`text-sm font-semibold ${
                            field.value === 'damaged' ? 'text-orange-700' : 'text-zinc-700'
                          }`}
                        >
                          Damaged
                        </p>
                        <p className="text-xs text-zinc-500">On-hand only, not sellable</p>
                      </div>
                    </button>
                  </div>
                )}
              />
              {errors.condition && (
                <p className="mt-1 text-xs text-red-600">{errors.condition.message}</p>
              )}
            </div>

            {/* Damaged info banner */}
            {condition === 'damaged' && (
              <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 md:col-span-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <p className="text-xs text-orange-700">
                  Damaged items are added to on-hand quantity only and will <strong>not</strong> be
                  available for sale.
                </p>
              </div>
            )}

            {/* Repair Decision (for damaged/serial-tracked units) */}
            {condition === 'damaged' && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  What should happen to this unit?
                </label>
                <Controller
                  name="repairDecision"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => field.onChange('restock')}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                          field.value === 'restock' || field.value === undefined
                            ? 'border-zinc-400 bg-zinc-50'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <PackageCheck className="h-5 w-5 text-zinc-500" />
                        <div className="text-center">
                          <p className="text-sm font-semibold text-zinc-700">Restock</p>
                          <p className="text-xs text-zinc-500">Keep as on-hand (damaged)</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange('flag_for_repair')}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                          field.value === 'flag_for_repair'
                            ? 'border-red-500 bg-red-50'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <Wrench
                          className={`h-5 w-5 ${field.value === 'flag_for_repair' ? 'text-red-600' : 'text-zinc-400'}`}
                        />
                        <div className="text-center">
                          <p
                            className={`text-sm font-semibold ${field.value === 'flag_for_repair' ? 'text-red-700' : 'text-zinc-700'}`}
                          >
                            Flag for Repair
                          </p>
                          <p className="text-xs text-zinc-500">Auto-creates a UDS</p>
                        </div>
                      </button>
                    </div>
                  )}
                />
              </div>
            )}

            {/* Serial Number — required to raise a UDS, and worth recording on
                any serial-tracked return so the unit that came back is the one
                on file. */}
            {showSerialPicker && (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Serial Number
                  {isRepairIntake && <span className="text-red-500">*</span>}
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    {isRepairIntake ? '(required to create UDS)' : '(which unit came back)'}
                  </span>
                </label>
                <Controller
                  name="serialNumberId"
                  control={control}
                  render={({ field }) =>
                    serialChoices.length > 0 ? (
                      <select
                        {...field}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      >
                        <option value="">Select serial number…</option>
                        {serialChoices.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.serialNumber}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...field}
                        type="text"
                        placeholder="Paste the SerialNumber record ID"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      />
                    )
                  }
                />
                <p className="mt-1 text-xs text-zinc-400">
                  {isRepairIntake
                    ? 'The unit is marked "in repair" and a UDS is auto-created.'
                    : soldSerials.length > 0
                      ? 'Units of this item that were sold — pick the one coming back.'
                      : 'No sold units on record for this item; leave blank if you are unsure.'}
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Notes
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="Reason for return, condition details…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Processing…' : 'Confirm Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
