'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { usePurchaseRequests } from './usePurchaseRequests'
import { usePurchaseOrders } from '../../purchase-orders/_hooks/usePurchaseOrders'
import { CreatePoModal } from '../../purchase-orders/_components/CreatePoModal'
import { NoDestinationWarning } from '../../purchase-orders/_components/NoDestinationWarning'
import { procurementHref } from '../../purchase-orders/_lib/procurementHref'
import { ConvertPrToPoModal } from '../_components/ConvertPrToPoModal'
import { ViewPurchaseRequestModal } from '../_components/ViewPurchaseRequestModal'
import { getPurchaseRequest } from '../_actions/get-purchase-request'
import { ConfirmActionModal } from '@/src/components/inventory/ConfirmActionModal'
import { hasPermission } from '@/src/hooks/usePermission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'

type Pr = PurchaseRequestSummary

export type PurchaseRequestActions = {
  can: { create: boolean; edit: boolean; cancel: boolean; convert: boolean }
  busy: { submitting: boolean; cancelling: boolean; converting: boolean }
  view: (pr: Pr) => void
  edit: (pr: Pr) => void
  submit: (pr: Pr) => void
  convert: (pr: Pr) => void
  cancel: (pr: Pr) => void
  /** Edit, Submit, Convert and detail modals — render once wherever the hook is used. */
  modals: React.ReactElement
}

/**
 * Everything you can do to an existing purchase request — edit, submit,
 * convert to PO, cancel, view — shared by the Purchase Requests list and the
 * open-requests section on the Purchase Orders list. Also opens the detail
 * view for a `?pr=<id>` deep link. With no session every action is off.
 */
export function usePurchaseRequestActions(session: SessionUser | null): PurchaseRequestActions {
  const can = {
    create: hasPermission(session, PROCUREMENT_PERMISSIONS.PR_CREATE),
    edit: hasPermission(session, PROCUREMENT_PERMISSIONS.PR_UPDATE),
    cancel: hasPermission(session, PROCUREMENT_PERMISSIONS.PR_CANCEL),
    convert: hasPermission(session, PROCUREMENT_PERMISSIONS.PO_CREATE),
  }
  const { updatePR, isUpdating, submitPR, isSubmitting, cancelPR, isCancelling } =
    usePurchaseRequests({ list: false })
  const { convertFromPr, isConverting } = usePurchaseOrders()

  const [editingPr, setEditingPr] = useState<Pr | null>(null)
  const [submittingPr, setSubmittingPr] = useState<Pr | null>(null)
  const [convertingPr, setConvertingPr] = useState<Pr | null>(null)
  const [viewingPr, setViewingPr] = useState<Pr | null>(null)

  // Deep link from a PO's Source column (?pr=<id>). Fetched on its own rather
  // than looked up in a list: the PR behind a PO is converted, which the
  // lists may hide or have pages away.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const linkedPrId = searchParams.get('pr')
  const linkedPrQuery = useQuery({
    queryKey: ['purchase-request', linkedPrId],
    queryFn: () => getPurchaseRequest(linkedPrId as string),
    enabled: !!linkedPrId,
  })

  // Derived rather than copied into state by an effect: the linked request IS
  // the open one until the reader closes it.
  const viewedPr = viewingPr ?? (linkedPrId ? (linkedPrQuery.data ?? null) : null)
  const closeViewedPr = (): void => {
    setViewingPr(null)
    // Drop the param on close so it doesn't reopen on the next render.
    // Rebuilt from the current URL so whatever ?tab= is there survives.
    if (!linkedPrId) return
    const rest = new URLSearchParams(searchParams.toString())
    rest.delete('pr')
    const query = rest.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }
  const fromView =
    (action: (pr: Pr) => void) =>
    (pr: Pr): void => {
      closeViewedPr()
      action(pr)
    }
  const cancel = (pr: Pr): void => void cancelPR(pr.id)

  const modals = (
    <>
      <CreatePoModal
        open={!!editingPr}
        onClose={() => setEditingPr(null)}
        pr={editingPr}
        onUpdate={async (id, data) => {
          await updatePR(id, data)
          setEditingPr(null)
        }}
        isSaving={isUpdating}
        currentUserBranchId={session?.branchId}
      />

      <ConfirmActionModal
        open={submittingPr !== null}
        onClose={() => setSubmittingPr(null)}
        title="Submit Purchase Request"
        icon={<Send className="h-5 w-5" />}
        iconColorClass="text-[#5b21b6]"
        summary={<p className="text-sm font-medium text-zinc-900">{submittingPr?.code}</p>}
        message="This sends the purchase request into the approval queue — you won't be able to edit it as a draft afterward."
        notice={
          submittingPr && (
            <NoDestinationWarning
              warehouseId={submittingPr.warehouseId}
              deliveryInstructions={submittingPr.deliveryInstructions}
              saved="submit"
            />
          )
        }
        confirmLabel="Submit"
        confirmingLabel="Submitting…"
        confirmButtonClass="bg-[#5b21b6] hover:bg-[#4a189b]"
        onConfirm={async () => {
          if (submittingPr) await submitPR(submittingPr.id)
        }}
        isConfirming={isSubmitting}
      />

      <ConvertPrToPoModal
        open={!!convertingPr}
        onClose={() => setConvertingPr(null)}
        pr={convertingPr}
        onConvert={async (prId, data) => {
          await convertFromPr(prId, data)
          setConvertingPr(null)
        }}
        isConverting={isConverting}
      />

      <ViewPurchaseRequestModal
        open={!!viewedPr}
        onClose={closeViewedPr}
        pr={viewedPr}
        canEdit={can.edit}
        canSubmit={can.create}
        canCancel={can.cancel}
        canConvert={can.convert}
        onEdit={fromView(setEditingPr)}
        onSubmit={fromView(setSubmittingPr)}
        onCancel={fromView(cancel)}
        onConvert={fromView(setConvertingPr)}
        onViewPo={(poId) => {
          closeViewedPr()
          router.push(procurementHref(pathname, 'orders', { po: poId }))
        }}
      />
    </>
  )

  return {
    can,
    busy: { submitting: isSubmitting, cancelling: isCancelling, converting: isConverting },
    view: setViewingPr,
    edit: setEditingPr,
    submit: setSubmittingPr,
    convert: setConvertingPr,
    cancel,
    modals,
  }
}
