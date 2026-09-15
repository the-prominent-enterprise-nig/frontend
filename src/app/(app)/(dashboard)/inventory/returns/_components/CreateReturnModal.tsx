'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  Loader2,
  PackageCheck,
  AlertTriangle,
  Wrench,
  FileText,
  PackageSearch,
} from 'lucide-react'
import { CreateReturnFormSchema, CreateReturnFormValues } from '@/src/schema/inventory/returns'
import { getCustomerPurchases } from '../_actions/get-customer-purchases'
import PurchasePicker from './PurchasePicker'
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
      // Both intake document numbers default to '' rather than being left out:
      // a Controller-driven input with an undefined value mounts uncontrolled
      // and switches to controlled on the first keystroke, which React warns
      // about. The RR field had this from the start; fixed here alongside.
      intakeSalesInvoiceNumber: '',
    },
  })

  const condition = watch('condition')
  const repairDecision = watch('repairDecision')
  const selectedItemId = watch('itemId')
  const arInvoiceId = watch('arInvoiceId')
  const customerId = watch('customerId')
  const serialNumberId = watch('serialNumberId')
  const [invoiceCustomerName, setInvoiceCustomerName] = useState<string | null>(null)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('')

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
  /** Locked only when a real document was found on the sale. A sale with no SI
   *  on record leaves the field open — the customer may still be holding paper
   *  this system never saw. */
  const derivedSalesInvoice = !!(
    selectedPurchase?.salesInvoiceNumber ?? selectedPurchase?.arInvoiceNumber
  )
  // Naming a customer commits the form to their own sale history — there is
  // no catalogue fallback from here. A return recorded against a customer we
  // cannot tie to a sale is a quantity with someone's name on it: it credits
  // nothing, reverses no cost correctly, and reads later as though the sale
  // was found when it never was. The loading tick counts as "has purchases"
  // so the picker never flashes past on its way in.
  const showPurchasePicker = !!customerId && (purchasesQuery.isLoading || purchases.length > 0)
  const noPurchasesOnRecord = !!customerId && !purchasesQuery.isLoading && purchases.length === 0

  // A unit taken in for repair stays the customer's property — it is never
  // added to stock and never credited — so there is nothing an invoice could
  // do here, and offering the field would promise a credit that never comes.
  const isCustodialRepairIntake = repairDecision === 'flag_for_repair'

  const itemSerials = useMemo(
    () => serialOptions.filter((s) => s.item?.id === selectedItemId),
    [serialOptions, selectedItemId]
  )
  // Memoized because serialChoices below depends on it: the `?? []` fallback
  // is a fresh array on every render, which would re-run that memo each time.
  const soldSerials = useMemo(
    () => soldSerialsQuery.data?.data?.data ?? [],
    [soldSerialsQuery.data]
  )
  /** Sold units first; the in-stock list is only a fallback for an item whose
   *  sale history predates serial tracking. The unit picked from the
   *  customer's purchases is prepended when the sold-serials lookup has not
   *  returned it — otherwise the select holds an id that is not among its own
   *  options and silently renders as unselected, which is how the wrong unit
   *  gets chosen by someone correcting what looks like an empty field. */
  const serialChoices = useMemo(() => {
    const base = soldSerials.length > 0 ? soldSerials : itemSerials
    const picked = selectedPurchase?.serialNumberId
    if (!picked || base.some((s) => s.id === picked)) return base
    return [
      {
        id: picked,
        serialNumber: selectedPurchase?.serialNumber ?? picked,
      } as (typeof base)[number],
      ...base,
    ]
  }, [soldSerials, itemSerials, selectedPurchase])

  const isRepairIntake = repairDecision === 'flag_for_repair'
  // A serial-tracked unit returned through the catalogue used to record no
  // serial at all — the picker only ever appeared for a repair.
  const showSerialPicker = isRepairIntake || (catalogueItemIsSerialTracked && !selectedPurchase)

  useEffect(() => {
    if (!isOpen) {
      reset()
      setInvoiceCustomerName(null)
      setSelectedPurchaseId('')
      setCatalogueItemIsSerialTracked(false)
    }
  }, [isOpen, reset])

  useEffect(() => {
    // Only ever a convenience for a unit nobody has identified yet. A serial
    // that came from the customer's own purchase is the unit physically on the
    // counter, and this used to overwrite it with whichever in-stock unit of
    // the same item happened to be the only one on the shelf — raising the UDS
    // against the wrong serial, marking a unit that never left the warehouse
    // "in repair", and leaving the customer's actual unit recorded as sold.
    if (selectedPurchase || serialNumberId) return
    if (repairDecision === 'flag_for_repair' && itemSerials.length === 1) {
      setValue('serialNumberId', itemSerials[0].id)
    }
  }, [repairDecision, itemSerials, selectedPurchase, serialNumberId, setValue])

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
    // The customer's proof of purchase is the sale we just picked — the clerk
    // was retyping a number the form already had, off a receipt it had already
    // matched. A repair intake drops arInvoiceId on purpose (nothing is being
    // credited), so without copying the number across, the SI was the one part
    // of the sale a UDS could not carry. Falls back to the POS transaction
    // number for a cash sale, which is the only reference that sale has.
    // Only a real document the customer could put on the counter: the
    // cashier-entered SI, or the AR invoice number for a charge sale whose SI
    // was left blank. The POS transaction number is deliberately NOT a
    // fallback — it appears on nothing they were handed, and writing it into a
    // field named for an SI makes the two indistinguishable afterwards. Left
    // blank instead, which is the truth: that sale has no SI on record.
    const documentNumber = purchase?.salesInvoiceNumber ?? purchase?.arInvoiceNumber ?? ''
    setValue('salesInvoiceNumber', documentNumber)
    setValue('intakeSalesInvoiceNumber', documentNumber)
    if (purchase) setValue('quantity', purchase.quantity)
  }

  /** Changing who returned it invalidates everything derived from them. */
  function handleCustomerChange(id: string, onChange: (v: string) => void) {
    onChange(id)
    setSelectedPurchaseId('')
    setCatalogueItemIsSerialTracked(false)
    setValue('itemId', '')
    setValue('serialNumberId', '')
    setValue('arInvoiceId', '')
    setValue('salesInvoiceNumber', '')
    setValue('intakeSalesInvoiceNumber', '')
  }

  async function handleFormSubmit(data: CreateReturnFormValues) {
    const result = await onSubmit({
      ...data,
      notes: data.notes || undefined,
      arInvoiceId: isCustodialRepairIntake ? undefined : data.arInvoiceId || undefined,
      // Kept for a repair intake too — it is the custody record the UDS is
      // built from, not just the credit-memo counterparty.
      customerId: data.customerId || undefined,
      salesInvoiceNumber: data.salesInvoiceNumber || undefined,
      intakeSalesInvoiceNumber: data.intakeSalesInvoiceNumber || undefined,
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

            {/* Item — picked from the customer's own purchases, so the unit,
                its serial, its price and its invoice all come from one
                choice. The catalogue search is only for an unattributed
                return, where there is no sale history to pick from. */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                {showPurchasePicker ? 'Returned unit' : 'Item'}{' '}
                <span className="text-red-500">*</span>
              </label>

              {showPurchasePicker ? (
                <PurchasePicker
                  purchases={purchases}
                  isLoading={purchasesQuery.isLoading}
                  selectedId={selectedPurchaseId}
                  onSelect={handlePurchasePick}
                />
              ) : noPurchasesOnRecord ? (
                <NoPurchasesNotice />
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

              {/* The catalogue combobox renders its own error; the picker and the
                  dead-end notice do not, so a blocked submit says why here
                  rather than failing silently. */}
              {(showPurchasePicker || noPurchasesOnRecord) && errors.itemId && (
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

            {/* Original Invoice — the customer-side half of the return. Only
                asked for on the catalogue path: a unit picked from the
                customer's own purchases already arrives with its invoice
                attached, shown on the line itself, so re-asking here invites
                the clerk to name a different one. */}
            {!isCustodialRepairIntake && !selectedPurchase && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Original Invoice
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
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
                <p className="mt-1 text-xs text-zinc-400">
                  {arInvoiceId
                    ? 'A sales-return credit memo will be issued against this invoice and its balance reduced.'
                    : 'Leave blank to record the stock movement only — the customer will not be credited automatically.'}
                </p>
              </div>
            )}

            {/* What naming that invoice actually does, said once the unit is
                chosen — the clerk should know a credit is about to be raised
                (or not) before they confirm, not discover it in the toast. */}
            {!isCustodialRepairIntake && selectedPurchase && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 md:col-span-2 ${
                  selectedPurchase.arInvoiceId
                    ? 'border-prominent-orange-200 bg-prominent-orange-50'
                    : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <FileText
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    selectedPurchase.arInvoiceId ? 'text-prominent-orange-700' : 'text-zinc-400'
                  }`}
                />
                <p className="text-xs text-zinc-700">
                  {selectedPurchase.arInvoiceId ? (
                    <>
                      Invoice{' '}
                      <span className="font-medium">{selectedPurchase.arInvoiceNumber}</span> is
                      attached to this unit — a sales-return credit memo will be issued against it
                      and its balance reduced.
                    </>
                  ) : (
                    <>
                      Sale <span className="font-medium">{selectedPurchase.transactionNumber}</span>{' '}
                      was settled at the till, so there is no invoice to credit — the stock movement
                      is recorded on its own.
                    </>
                  )}
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

            {/* The RR the customer walks away with. Issued by the server on
                save, not typed: a clerk inventing a number off a pad meant
                nothing stopped two branches issuing the same one, and nothing
                checked the typed number against anything. Announced here so
                the clerk knows a number is coming and does not write their own
                on the pad first. */}
            {isCustodialRepairIntake && (
              <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:col-span-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <p className="text-xs text-zinc-600">
                  An <strong>RR number</strong> will be issued when you confirm. Write it on the
                  customer&apos;s copy — it is shown as soon as the intake is saved.
                </p>
              </div>
            )}

            {/* Scenario 50 — the customer's proof of purchase, recorded so a
                repair can be traced back to the sale it came from. Free text,
                exactly like the RR number above: the unit may have been sold
                on paper, before this system, or by a branch whose records
                never became an ArInvoice row. Optional on purpose — a
                customer who cannot produce the SI should still be able to
                leave the unit for repair. */}
            {isCustodialRepairIntake && (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Customer&apos;s SI # (proof of purchase){' '}
                  <span className="text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="intakeSalesInvoiceNumber"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. SI-20260101-0042"
                      maxLength={50}
                      readOnly={derivedSalesInvoice}
                      className={`w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${
                        derivedSalesInvoice ? 'bg-zinc-50 text-zinc-700' : 'bg-white'
                      }`}
                    />
                  )}
                />
                {selectedPurchase && (
                  <p className="mt-1 text-xs text-zinc-400">
                    {selectedPurchase.salesInvoiceNumber
                      ? 'The SI the cashier recorded on that sale.'
                      : selectedPurchase.arInvoiceNumber
                        ? 'No SI was recorded at the till, so the AR invoice number stands in.'
                        : `No SI was recorded on that sale (${selectedPurchase.transactionNumber}). Type the number off the customer's receipt if they have one.`}
                  </p>
                )}
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

/** A named customer with nothing on record is a dead end on purpose. The
 *  catalogue used to sit here as a fallback, which let a clerk record a return
 *  "for" someone against a sale that was never found — a quantity with a name
 *  on it that credits nothing and reads later as though the sale matched.
 *
 *  Three things actually produce this: a sale imported from the old books or
 *  done on paper, a POS sale rung up before the customer was identified, and a
 *  sale already returned through the POS queue (excluded deliberately, so it
 *  is not credited twice). The first two are recoverable by fixing the sale;
 *  the third means the return is already done. Clearing the customer records
 *  the stock movement on its own, which is the honest version of what the
 *  catalogue fallback was doing silently. */
function NoPurchasesNotice(): React.ReactElement {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-5 text-center">
      <PackageSearch className="mx-auto h-5 w-5 text-zinc-300" />
      <p className="mt-2 text-sm font-medium text-zinc-700">No sale on record for this customer</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
        Their purchase may predate the system, have been rung up before they were identified, or
        already have been returned through POS. Attach the customer to the sale first, or clear the
        Customer field above to record this as an unattributed return.
      </p>
    </div>
  )
}
