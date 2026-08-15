'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, ShoppingCart } from 'lucide-react'
import { CreatePoFormSchema, type CreatePoFormValues } from '@/src/schema/inventory/purchase-orders'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'
import { PurchaseOrderFormFields } from './PurchaseOrderFormFields'

type Props = {
  open: boolean
  onClose: () => void
  // Creating always drafts a Purchase Request (pending approval) — there's
  // no more "skip the draft, create a live PO" path. A PO only comes into
  // being afterward, via approve -> convert. This same modal, unchanged,
  // also handles editing an existing draft PR (pr/onUpdate below).
  onCreate?: (data: CreatePoFormValues) => Promise<void>
  isCreating?: boolean
  pr?: PurchaseRequestSummary | null
  onUpdate?: (id: string, data: CreatePoFormValues) => Promise<void>
  isSaving?: boolean
  /** Sent as branchId attribution ("requested by this branch") — not a
   * visible form field, forced server-side (user.branchId ?? dto.branchId)
   * for a branch-scoped creator regardless of what's submitted.
   * null/undefined (Head Office / Business Owner) leaves it unattributed. */
  currentUserBranchId?: string | null
}

// Computes the form's default values for either create mode (no pr) or edit
// mode (pr provided). On create, branchId defaults to the actor's own
// branch (forced server-side regardless). On edit, the PR's existing
// branchId is preserved as-is rather than silently reattributed.
function getDefaultValues(
  pr: PurchaseRequestSummary | null | undefined,
  currentUserBranchId: string | null | undefined
): CreatePoFormValues {
  if (pr) {
    return {
      supplierId: pr.supplierId ?? '',
      branchId: pr.branchId ?? undefined,
      warehouseId: pr.warehouseId ?? '',
      expectedDeliveryDate: pr.expectedDeliveryDate
        ? pr.expectedDeliveryDate.slice(0, 10)
        : undefined,
      deliveryInstructions: pr.deliveryInstructions ?? undefined,
      paymentTerms: pr.paymentTerms ?? undefined,
      shippingAddress: pr.shippingAddress ?? undefined,
      notes: pr.notes ?? undefined,
      lines: pr.lines.map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice != null ? Number(line.unitPrice) : 0,
        description: line.description ?? undefined,
        notes: line.notes ?? undefined,
        srp: line.srp != null ? Number(line.srp) : undefined,
        discounts: line.discounts ?? [],
        isFreebie: line.isFreebie ?? false,
      })),
    }
  }

  return {
    supplierId: '',
    branchId: currentUserBranchId ?? undefined,
    warehouseId: '',
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
        discounts: [],
        isFreebie: false,
      },
    ],
  }
}

export function CreatePoModal({
  open,
  onClose,
  onCreate,
  isCreating,
  pr,
  onUpdate,
  isSaving,
  currentUserBranchId,
}: Props) {
  const isEditMode = !!pr
  const isBusy = isEditMode ? isSaving : isCreating

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CreatePoFormValues>({
    resolver: zodResolver(CreatePoFormSchema),
    defaultValues: getDefaultValues(pr, currentUserBranchId),
  })

  useEffect(() => {
    if (open && pr) {
      reset(getDefaultValues(pr, currentUserBranchId))
    } else if (!open) {
      reset(getDefaultValues(null, currentUserBranchId))
    }
  }, [open, pr, currentUserBranchId, reset])

  async function handleFormSubmit(data: CreatePoFormValues) {
    if (pr) {
      await onUpdate?.(pr.id, data)
    } else {
      await onCreate?.(data)
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-prominent-purple-600" />
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEditMode ? 'Edit Purchase Request' : 'New Purchase'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
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
            <PurchaseOrderFormFields
              control={control}
              register={register}
              errors={errors}
              setValue={setValue}
              getValues={getValues}
              open={open}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-60"
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditMode
                ? isBusy
                  ? 'Saving…'
                  : 'Save Changes'
                : isBusy
                  ? 'Creating…'
                  : 'Create Purchase Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
