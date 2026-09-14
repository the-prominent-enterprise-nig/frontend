'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trash2 } from 'lucide-react'
import { CreatePoFormSchema, type CreatePoFormValues } from '@/src/schema/inventory/purchase-orders'
import { locationLabel } from '@/src/libs/format/locationLabel'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { ConfirmActionModal } from '@/src/components/inventory/ConfirmActionModal'
import { PurchaseOrderFormFields } from './PurchaseOrderFormFields'
import { PLEX, MONO } from './procurementTokens'

// The action bar sits outside the <form> (it is sticky, the form scrolls),
// so its buttons reach the form by id rather than by nesting.
const FORM_ID = 'purchase-order-form'

const STATUS_LABELS: Record<PurchaseOrderSummary['status'], string> = {
  draft: 'Draft',
  approved: 'Approved',
  sent: 'Sent',
  partially_received: 'Partial',
  fully_received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

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
    notes: undefined,
    // Starts empty: lines are added from the catalog search at the foot of
    // the line-items card, so a blank placeholder row would just have to be
    // filled or removed. Zod still requires at least one before submit.
    lines: [],
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
  // Keyed by itemId, not position: lines can be reordered (a new line is
  // prepended), and a positional list would then hand each line its
  // neighbour's label.
  const initialItemLabels = Object.fromEntries(
    ((po ?? pr)?.lines ?? [])
      .filter((line) => line.itemId && line.item?.name)
      .map((line) => [line.itemId, line.item!.name as string])
  )
  const initialSupplierLabel = (po ?? pr)?.supplier?.name
  // Location too, through the same helper the rest of the app labels a
  // destination with: a branch's location is stored as "{branch} Warehouse"
  // but reads as just the branch everywhere it is shown, while a standalone
  // warehouse keeps its own name. Using the raw name here made an existing
  // PO open on "Bago Warehouse" where the picker itself says "Bago".
  // Only when there IS one: locationLabel falls back to an em dash, and
  // handing that to the combobox as a confirmed label hides its "Search
  // location by branch or code…" placeholder on a brand-new PO.
  const poWarehouse = (po ?? pr)?.warehouse
  const initialWarehouseLabel = poWarehouse ? locationLabel(poWarehouse) : undefined

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<CreatePoFormValues>({
    resolver: zodResolver(CreatePoFormSchema),
    defaultValues: getDefaultValues(pr, po, currentUserBranchId),
  })

  const [confirmDiscard, setConfirmDiscard] = useState(false)

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
      : 'New Purchase Request'
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

  // The code is assigned server-side on save, so there is nothing real to
  // show on a new record — the chip stands in until then.
  // Only a saved record has a code; a new one shows no chip at all.
  const code = po?.code ?? pr?.code ?? null
  const breadcrumb = isPoEditMode
    ? 'Purchase Orders › Edit'
    : isPrEditMode
      ? 'Purchase Requests › Edit'
      : 'Purchase Orders › New'
  const statusLabel = isPoEditMode ? (STATUS_LABELS[po!.status] ?? 'Draft') : 'Draft'

  return (
    // absolute, not fixed: the working surface fills the content column
    // (the app shell's `main` is the positioning frame) so the nav sidebar
    // and top bar stay visible and usable while a purchase is being drafted.
    // Same shell as PoDetailModal.
    <div className={`${PLEX} absolute inset-0 z-50 flex flex-col bg-[#f2f2f3] text-[#17171c]`}>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-5 border-b border-[#e4e4e9] bg-white px-5 py-3">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <div className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
            {breadcrumb}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[17px] font-semibold tracking-[-.01em]">{title}</h2>
            {code && (
              <span
                className={`${MONO} rounded-[5px] border border-[#e4e4e9] bg-[#faf9fb] px-1.5 py-0.5 text-[11px] text-[#5b5b6b]`}
              >
                {code}
              </span>
            )}
            <span className="rounded-[5px] bg-[#fdf3e7] px-2 py-0.5 text-[11px] font-medium text-[#8a4b06]">
              {statusLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (isDirty ? setConfirmDiscard(true) : onClose())}
            disabled={isBusy}
            className="rounded-lg px-3 py-2 text-[13px] text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c] disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={isBusy || (isEditMode && !isDirty)}
            className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#4a189b] disabled:opacity-60"
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>

      {isPoEditMode && (po?.status === 'approved' || po?.status === 'sent') && (
        <div className="mx-5 mt-3 rounded-lg border border-[#f7dfc0] bg-[#fdf3e7] px-4 py-2.5 text-[12px] text-[#8a4b06]">
          This PO is already {po?.status}. Saving changes reverts it to Draft and voids the existing
          approval — it will need to be approved again.
        </div>
      )}

      <form
        id={FORM_ID}
        onSubmit={handleSubmit(handleFormSubmit)}
        noValidate
        className="flex flex-1 flex-col overflow-y-auto"
      >
        <PurchaseOrderFormFields
          control={control}
          register={register}
          errors={errors}
          setValue={setValue}
          initialItemLabels={initialItemLabels}
          initialSupplierLabel={initialSupplierLabel}
          initialWarehouseLabel={initialWarehouseLabel}
          submitted={isSubmitted}
        />
      </form>

      {/* Discarding throws away everything typed so far — there is no draft
          behind it to fall back on. Only asked when the form is actually
          dirty; an untouched form just closes. */}
      <ConfirmActionModal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard changes"
        icon={<Trash2 className="h-5 w-5" />}
        iconColorClass="text-red-600"
        summary={<p className="text-sm font-medium text-zinc-900">{title}</p>}
        message={
          isEditMode
            ? 'Your unsaved edits will be lost. The saved record itself is not changed.'
            : 'Everything entered on this form will be lost. Nothing has been saved yet.'
        }
        confirmLabel="Discard"
        confirmingLabel="Discarding…"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        onConfirm={async () => {
          setConfirmDiscard(false)
          onClose()
        }}
      />
    </div>
  )
}
