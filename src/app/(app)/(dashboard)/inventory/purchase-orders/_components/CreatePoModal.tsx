'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, ShoppingCart } from 'lucide-react'
import { CreatePoFormSchema, type CreatePoFormValues } from '@/src/schema/inventory/purchase-orders'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
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
  // Scenario 29 PO-06/PO-08 — editing an existing PO directly (draft, or
  // approved/sent — the backend reverts those to draft and voids the prior
  // approval). Mutually exclusive with pr/onUpdate above.
  po?: PurchaseOrderSummary | null
  onUpdatePo?: (id: string, data: CreatePoFormValues) => Promise<void>
  isSavingPo?: boolean
  /** Sent as branchId attribution ("requested by this branch") — not a
   * visible form field, forced server-side (user.branchId ?? dto.branchId)
   * for a branch-scoped creator regardless of what's submitted.
   * null/undefined (Head Office / Business Owner) leaves it unattributed. */
  currentUserBranchId?: string | null
}

// Computes the form's default values for create mode (no pr/po), PR-edit
// mode (pr provided), or PO-edit mode (po provided). On create, branchId
// defaults to the actor's own branch (forced server-side regardless). On
// edit, the existing record's branchId/fields are preserved as-is rather
// than silently reattributed.
function getDefaultValues(
  pr: PurchaseRequestSummary | null | undefined,
  po: PurchaseOrderSummary | null | undefined,
  currentUserBranchId: string | null | undefined
): CreatePoFormValues {
  const source = po ?? pr
  if (source) {
    return {
      supplierId: source.supplierId ?? '',
      branchId: (po ? po.branchId : pr?.branchId) ?? undefined,
      warehouseId: source.warehouseId ?? '',
      expectedDeliveryDate: source.expectedDeliveryDate
        ? source.expectedDeliveryDate.slice(0, 10)
        : undefined,
      deliveryInstructions: source.deliveryInstructions ?? undefined,
      paymentTerms: source.paymentTerms ?? undefined,
      notes: source.notes ?? undefined,
      lines: source.lines.map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice != null ? Number(line.unitPrice) : 0,
        description: line.description ?? undefined,
        notes: line.notes ?? undefined,
        srp: line.srp != null ? Number(line.srp) : undefined,
        discounts:
          line.discounts && line.discounts.length > 0
            ? line.discounts
            : [{ type: 'percentage', value: 0 }],
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
    notes: undefined,
    lines: [
      {
        itemId: '',
        quantity: 1,
        unitPrice: 0,
        description: undefined,
        notes: undefined,
        srp: undefined,
        discounts: [{ type: 'percentage', value: 0 }],
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
  po,
  onUpdatePo,
  isSavingPo,
  currentUserBranchId,
}: Props) {
  const isPrEditMode = !!pr
  const isPoEditMode = !!po
  const isBusy = isPoEditMode ? isSavingPo : isPrEditMode ? isSaving : isCreating
  // Nothing to save yet if editing and the loaded record hasn't been touched.
  const isEditMode = isPoEditMode || isPrEditMode

  // Edit mode's line items come in pre-filled with an itemId but no display
  // name — ItemSearchCombobox only knows an id, so without this it renders
  // blank instead of showing what's already selected (SearchCombobox seeds
  // its shown label from initialLabel once, on mount). Same story for the
  // Supplier field.
  const initialItemLabels = (po ?? pr)?.lines.map((line) => line.item?.name)
  const initialSupplierLabel = (po ?? pr)?.supplier?.name

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<CreatePoFormValues>({
    resolver: zodResolver(CreatePoFormSchema),
    defaultValues: getDefaultValues(pr, po, currentUserBranchId),
  })

  useEffect(() => {
    if (open && (pr || po)) {
      reset(getDefaultValues(pr, po, currentUserBranchId))
    } else if (!open) {
      reset(getDefaultValues(null, null, currentUserBranchId))
    }
  }, [open, pr, po, currentUserBranchId, reset])

  async function handleFormSubmit(data: CreatePoFormValues) {
    if (po) {
      await onUpdatePo?.(po.id, data)
    } else if (pr) {
      await onUpdate?.(pr.id, data)
    } else {
      await onCreate?.(data)
    }
    onClose()
  }

  if (!open) return null

  const title = isPoEditMode
    ? 'Edit Purchase Order'
    : isPrEditMode
      ? 'Edit Purchase Request'
      : 'New Purchase'
  const submitLabel = isPoEditMode
    ? isBusy
      ? 'Saving…'
      : 'Save Changes'
    : isPrEditMode
      ? isBusy
        ? 'Saving…'
        : 'Save Changes'
      : isBusy
        ? 'Creating…'
        : 'Create Purchase Request'

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-prominent-purple-600" />
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
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

      {isPoEditMode && (po?.status === 'approved' || po?.status === 'sent') && (
        <div className="mx-6 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          This PO is already {po?.status}. Saving changes reverts it to Draft and voids the existing
          approval — it will need to be approved again.
        </div>
      )}

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        noValidate
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <PurchaseOrderFormFields
            control={control}
            register={register}
            errors={errors}
            setValue={setValue}
            getValues={getValues}
            open={open}
            initialItemLabels={initialItemLabels}
            initialSupplierLabel={initialSupplierLabel}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-3">
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
            disabled={isBusy || (isEditMode && !isDirty)}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-60"
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
