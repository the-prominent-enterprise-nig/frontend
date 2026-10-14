'use client'

/* Scenario 72 — New / edit Delivery Receipt, laid out as the client's
 * mockup: Purpose, Issue details, Reference and approval, Items,
 * Attachments, then Save draft / Submit for approval — inside the same
 * full-screen header / body / action-bar shell as the Debit Memo form. Saving a draft touches no
 * stock; the DR number is taken on the first save. Print preview arrives with
 * the printables (Part 5). */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormProvider, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import AttachmentsPanel, { uploadAndAttach } from '@/src/components/common/AttachmentsPanel'
import { showToast } from '@/src/components/ui/toast'
import {
  DrFormSchema,
  DrSubmitSchema,
  type DrFormValues,
} from '@/src/schema/inventory/delivery-receipts'
import { saveDeliveryReceipt } from '../_actions/save-delivery-receipt'
import { submitDeliveryReceipt } from '../_actions/submit-delivery-receipt'
import { getDeliveryReceiptPrint } from '../_actions/get-delivery-receipt-document'
import { printDeliveryReceipt } from '@/src/libs/print/printDeliveryReceipt'
import { emptyDrForm } from '../_lib/dr-form-values'
import { fmtPeso } from '../_lib/dr-format'
import { DrIssueSection, DrPurposeSection, DrReferenceSection } from './DrFormSections'
import { DrItemsSection } from './DrItemsSection'
import { DeleteDraftButton } from './DeleteDraftButton'
import {
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  DrShell,
  HeaderFigure,
  NumberChip,
} from './drFormUi'

const ENTITY_TYPE = 'DeliveryReceipt'
const BACK_HREF = '/inventory/stock-transaction?tab=delivery-receipts'

type Props = {
  /** Set when editing an existing draft. */
  draft?: { id: string; drNumber: string; values: DrFormValues }
}

export default function DrForm({ draft }: Props): React.JSX.Element {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<'save' | 'submit' | 'print' | null>(null)
  const [staged, setStaged] = useState<File[]>([])
  const form = useForm<DrFormValues>({
    resolver: zodResolver(DrFormSchema),
    defaultValues: draft?.values ?? emptyDrForm(),
  })

  /** Saves (creating on first save), uploads staged files, returns the id. */
  async function persist(values: DrFormValues): Promise<string | null> {
    const res = await saveDeliveryReceipt(draft?.id ?? null, values)
    if (!res.success || !res.data) {
      showToast({ title: res.message ?? 'Failed to save the draft', status: 'error' })
      return null
    }
    if (staged.length) {
      const failed = await uploadAndAttach(ENTITY_TYPE, res.data.id, staged)
      setStaged([])
      if (failed) showToast({ title: `${failed} attachment(s) failed to upload`, status: 'error' })
    }
    return res.data.id
  }

  async function onSaveDraft(values: DrFormValues): Promise<void> {
    setBusy('save')
    const id = await persist(values)
    setBusy(null)
    if (!id) return
    showToast({ title: 'Draft saved', status: 'success' })
    await queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] })
    if (!draft) router.push(`/inventory/delivery-receipts/${id}`)
    else router.refresh()
  }

  /** A DR only prints once it has a number, so the preview saves the draft
   * first; the print carries a DRAFT watermark until it is approved. */
  async function onPrintPreview(values: DrFormValues): Promise<void> {
    setBusy('print')
    const id = await persist(values)
    // A return to supplier drafts its memo with the DR, so the preview
    // carries it too.
    const doc = id
      ? await getDeliveryReceiptPrint(id, values.purpose === 'return_to_supplier')
      : null
    setBusy(null)
    if (!id) return
    if (doc?.success && doc.data) printDeliveryReceipt(doc.data.dr, doc.data.memo)
    else showToast({ title: 'Saved, but the preview could not load', status: 'error' })
    await queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] })
    if (!draft) router.push(`/inventory/delivery-receipts/${id}`)
    else router.refresh()
  }

  /** Same rules the backend enforces on submit, shown on the fields first. */
  function checkSubmittable(values: DrFormValues): boolean {
    const parsed = DrSubmitSchema.safeParse(values)
    if (parsed.success) return true
    for (const issue of parsed.error.issues) {
      form.setError(issue.path.join('.') as FieldPath<DrFormValues>, { message: issue.message })
    }
    showToast({ title: 'A few things are missing before this can be submitted', status: 'error' })
    return false
  }

  async function onSubmitForApproval(values: DrFormValues): Promise<void> {
    if (!checkSubmittable(values)) return
    setBusy('submit')
    const id = await persist(values)
    const res = id ? await submitDeliveryReceipt(id) : null
    setBusy(null)
    if (!id || !res) return
    if (!res.success) {
      showToast({ title: res.message ?? 'Failed to submit', status: 'error' })
      if (!draft) router.push(`/inventory/delivery-receipts/${id}`)
      return
    }
    showToast({ title: 'Submitted for approval', status: 'success' })
    await queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] })
    router.push(`/inventory/delivery-receipts/${id}`)
    router.refresh()
  }

  /** Lines name units on one warehouse's shelf; a new warehouse clears them. */
  function onWarehouseChange(warehouseId: string): void {
    const hadLines = form.getValues('lines').length > 0
    form.setValue('warehouseId', warehouseId, { shouldDirty: true, shouldValidate: true })
    if (hadLines) {
      form.setValue('lines', [], { shouldDirty: true })
      showToast({ title: 'Items cleared — they were picked from the other branch', status: 'info' })
    }
  }

  return (
    <FormProvider {...form}>
      <DrShell
        title={draft ? 'Edit delivery receipt' : 'New delivery receipt'}
        chip={draft && <NumberChip>{draft.drNumber}</NumberChip>}
        subtitle="For stock that leaves the warehouse without a sale. Saving as a draft does not touch stock."
        headerAside={<EstimatedCost />}
        status={
          draft
            ? `Draft ${draft.drNumber} — nothing moves until it is submitted and approved.`
            : 'Nothing is saved until you click Save draft, which takes the DR number.'
        }
        actions={
          <FormActions
            draft={draft}
            busy={busy}
            onSave={form.handleSubmit(onSaveDraft)}
            onPrint={form.handleSubmit(onPrintPreview)}
            onSubmit={form.handleSubmit(onSubmitForApproval)}
          />
        }
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()} noValidate>
          <DrPurposeSection />
          <DrIssueSection drNumber={draft?.drNumber} onWarehouseChange={onWarehouseChange} />
          <DrReferenceSection />
          <DrItemsSection />
          <AttachmentsPanel
            entityType={ENTITY_TYPE}
            entityId={draft?.id}
            title="Attachments"
            description="Request letter, approval memo, waybill or photos of the units. PDF or images, up to 10 MB each."
            staged={staged}
            onStagedChange={setStaged}
          />
        </form>
      </DrShell>
    </FormProvider>
  )
}

/** The lines' cost at today's estimate — the real cost is stamped on posting. */
function EstimatedCost(): React.JSX.Element {
  const lines = useWatch<DrFormValues, 'lines'>({ name: 'lines' })
  const total = lines.reduce(
    (sum, l) => sum + (l.unitCost ?? 0) * (l.isSerialTracked ? 1 : l.quantity),
    0
  )
  return <HeaderFigure label="Estimated cost" value={fmtPeso(total)} />
}

function FormActions({
  draft,
  busy,
  onSave,
  onPrint,
  onSubmit,
}: {
  draft?: { id: string; drNumber: string }
  busy: 'save' | 'submit' | 'print' | null
  onSave: () => void
  onPrint: () => void
  onSubmit: () => void
}): React.JSX.Element {
  const spinner = <Loader2 className="h-4 w-4 animate-spin" />
  return (
    <>
      {draft && <DeleteDraftButton id={draft.id} drNumber={draft.drNumber} />}
      <Link href={BACK_HREF} className={BTN_GHOST}>
        Cancel
      </Link>
      <button type="button" onClick={onSave} disabled={!!busy} className={BTN_SECONDARY}>
        {busy === 'save' && spinner}
        Save draft
      </button>
      <button type="button" onClick={onPrint} disabled={!!busy} className={BTN_SECONDARY}>
        {busy === 'print' ? spinner : <Printer className="h-4 w-4" />}
        Print preview
      </button>
      <button type="button" onClick={onSubmit} disabled={!!busy} className={BTN_PRIMARY}>
        {busy === 'submit' && spinner}
        Submit for approval
      </button>
    </>
  )
}
