'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2, ShoppingCart } from 'lucide-react'
import { CreatePoFormSchema, type CreatePoFormValues } from '@/src/schema/inventory/purchase-orders'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import { BranchSearchCombobox } from '../../purchase-requests/_components/BranchSearchCombobox'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreatePoFormValues) => Promise<void>
  isSubmitting?: boolean
  /** A branch-scoped creator (Stock Controller/Branch Manager) always gets
   * this PO tied to their own branch — the backend already forces this
   * server-side (user.branchId ?? dto.branchId) regardless of what's
   * submitted, so leaving the field as free-choice for them is actively
   * misleading. null/undefined (head office / Business Owner) leaves it
   * open, since their POs can be enterprise-wide. */
  currentUserBranchId?: string | null
  currentUserBranchName?: string | null
}

export function CreatePoModal({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  currentUserBranchId,
  currentUserBranchName,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePoFormValues>({
    resolver: zodResolver(CreatePoFormSchema),
    defaultValues: {
      supplierId: '',
      branchId: currentUserBranchId ?? undefined,
      warehouseId: undefined,
      expectedDeliveryDate: undefined,
      deliveryInstructions: undefined,
      paymentTerms: undefined,
      shippingAddress: undefined,
      notes: undefined,
      lines: [
        {
          itemId: '',
          quantity: 1,
          unitPrice: 0,
          description: undefined,
          notes: undefined,
          srp: undefined,
          discountType: undefined,
          discountValue: undefined,
          isFreebie: false,
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const lines = watch('lines')

  const subtotal = lines.reduce((sum, line) => {
    if (line.isFreebie) return sum
    const qty = Number(line.quantity) || 0
    const price = Number(line.unitPrice) || 0
    return sum + qty * price
  }, 0)

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  async function handleFormSubmit(data: CreatePoFormValues) {
    await onSubmit(data)
    onClose()
  }

  if (!open) return null

  const fmtAmount = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-prominent-purple-600" />
            <h2 className="text-lg font-semibold text-zinc-900">New Purchase Order</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Supplier */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Supplier <span className="text-red-500">*</span>
              </label>
              <Controller
                name="supplierId"
                control={control}
                render={({ field }) => (
                  <SupplierSearchCombobox
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.supplierId?.message}
                  />
                )}
              />
              {errors.supplierId && (
                <p className="mt-1 text-xs text-red-500">{errors.supplierId.message}</p>
              )}
            </div>

            {/* Branch */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Branch</label>
              {currentUserBranchId ? (
                <>
                  <div className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                    {currentUserBranchName ?? 'Your branch'}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Purchase orders you create always belong to your own branch.
                  </p>
                </>
              ) : (
                <Controller
                  name="branchId"
                  control={control}
                  render={({ field }) => (
                    <BranchSearchCombobox
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      error={errors.branchId?.message}
                    />
                  )}
                />
              )}
              {errors.branchId && (
                <p className="mt-1 text-xs text-red-500">{errors.branchId.message}</p>
              )}
            </div>

            {/* Optional fields row 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  {...register('expectedDeliveryDate')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Payment Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Net 30"
                  {...register('paymentTerms')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.paymentTerms && (
                  <p className="mt-1 text-xs text-red-500">{errors.paymentTerms.message}</p>
                )}
              </div>
            </div>

            {/* Delivery Instructions */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Delivery Instructions
              </label>
              <textarea
                rows={2}
                {...register('deliveryInstructions')}
                className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
              />
              {errors.deliveryInstructions && (
                <p className="mt-1 text-xs text-red-500">{errors.deliveryInstructions.message}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <textarea
                rows={2}
                {...register('notes')}
                className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
              />
              {errors.notes && <p className="mt-1 text-xs text-red-500">{errors.notes.message}</p>}
            </div>

            {/* Line Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Line Items <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    append({
                      itemId: '',
                      quantity: 1,
                      unitPrice: 0,
                      description: undefined,
                      notes: undefined,
                      srp: undefined,
                      discountType: undefined,
                      discountValue: undefined,
                      isFreebie: false,
                    })
                  }
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Line
                </button>
              </div>

              {errors.lines && !Array.isArray(errors.lines) && (
                <p className="mb-2 text-xs text-red-500">{errors.lines.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Item <span className="text-red-500">*</span>
                        </label>
                        <Controller
                          name={`lines.${index}.itemId`}
                          control={control}
                          render={({ field: f }) => (
                            <ItemSearchCombobox
                              value={f.value}
                              onChange={f.onChange}
                              error={errors.lines?.[index]?.itemId?.message}
                            />
                          )}
                        />
                        {errors.lines?.[index]?.itemId && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.lines[index]?.itemId?.message}
                          </p>
                        )}
                      </div>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="mt-5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="0"
                          {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                        />
                        {errors.lines?.[index]?.quantity && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.lines[index]?.quantity?.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Unit Price <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          disabled={lines[index]?.isFreebie}
                          {...register(`lines.${index}.unitPrice`, { valueAsNumber: true })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500 disabled:bg-zinc-100 disabled:text-zinc-400"
                        />
                        {errors.lines?.[index]?.unitPrice && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.lines[index]?.unitPrice?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Supplier discount pricing (Scenario 10 Part 6) */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Supplier SRP
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          {...register(`lines.${index}.srp`, {
                            setValueAs: (v) => (v === '' ? undefined : Number(v)),
                          })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Discount Type
                        </label>
                        <select
                          {...register(`lines.${index}.discountType`, {
                            setValueAs: (v) => (v === '' ? undefined : v),
                          })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                        >
                          <option value="">— No discount —</option>
                          <option value="percentage">Percentage</option>
                          <option value="amount">Flat amount</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Discount {lines[index]?.discountType === 'amount' ? 'Amount' : '%'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          {...register(`lines.${index}.discountValue`, {
                            setValueAs: (v) => (v === '' ? undefined : Number(v)),
                          })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      </div>
                    </div>

                    {(() => {
                      const line = lines[index]
                      const srp = Number(line?.srp)
                      const discVal = Number(line?.discountValue)
                      if (!line?.srp || !line.discountType || line.discountValue == null)
                        return null
                      const discountedCost =
                        line.discountType === 'percentage'
                          ? srp * (1 - discVal / 100)
                          : srp - discVal
                      return (
                        <div className="text-xs bg-emerald-50 text-emerald-700 rounded-lg px-3 py-1.5">
                          Discounted cost:{' '}
                          <span className="font-semibold">{fmtAmount(discountedCost)}</span>
                        </div>
                      )
                    })()}

                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">
                        Description
                      </label>
                      <input
                        type="text"
                        placeholder="Optional line description"
                        {...register(`lines.${index}.description`)}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                      />
                    </div>

                    {/* Freebie (Scenario 10 Part 8) */}
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={Boolean(lines[index]?.isFreebie)}
                        onChange={(e) => {
                          setValue(`lines.${index}.isFreebie`, e.target.checked)
                          if (e.target.checked) setValue(`lines.${index}.unitPrice`, 0)
                        }}
                      />
                      Freebie (supplier-given free unit — no cost)
                    </label>

                    {/* Running line total */}
                    <div className="text-right text-xs text-zinc-500">
                      Line total:{' '}
                      <span className="font-medium text-zinc-800">
                        {fmtAmount(
                          (Number(lines[index]?.quantity) || 0) *
                            (Number(lines[index]?.unitPrice) || 0)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtotal */}
            <div className="flex items-center justify-end rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-sm font-medium text-zinc-700">Subtotal:&nbsp;</span>
              <span className="text-base font-semibold text-zinc-900">{fmtAmount(subtotal)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
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
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating…' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
