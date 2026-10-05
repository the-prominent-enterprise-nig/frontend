import { can, type SessionUser } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'

export type ProcurementHubPermissions = {
  canReadOrders: boolean
  canReadRequests: boolean
  canCreate: boolean
  canApprove: boolean
  canSend: boolean
  canCancel: boolean
  canClose: boolean
  canEdit: boolean
  canReceive: boolean
  canViewCost: boolean
  canViewApBill: boolean
}

// Shared by the Purchase Orders page and the Stock Transaction hub so the two
// can't drift apart on who may do what.
export function getProcurementHubPermissions(session: SessionUser): ProcurementHubPermissions {
  const canClose =
    can(session, PROCUREMENT_PERMISSIONS.PO_UPDATE) ||
    can(session, PROCUREMENT_PERMISSIONS.WILDCARD)
  return {
    canReadOrders: can(session, PROCUREMENT_PERMISSIONS.PO_READ),
    canReadRequests: can(session, PROCUREMENT_PERMISSIONS.PR_READ),
    // The "+ New Purchase" button always drafts a Purchase Request now.
    canCreate:
      can(session, PROCUREMENT_PERMISSIONS.PR_CREATE) ||
      can(session, PROCUREMENT_PERMISSIONS.WILDCARD),
    canApprove:
      can(session, PROCUREMENT_PERMISSIONS.PO_APPROVE) ||
      can(session, PROCUREMENT_PERMISSIONS.WILDCARD),
    canSend:
      can(session, PROCUREMENT_PERMISSIONS.PO_SEND) ||
      can(session, PROCUREMENT_PERMISSIONS.WILDCARD),
    canCancel:
      can(session, PROCUREMENT_PERMISSIONS.PO_CANCEL) ||
      can(session, PROCUREMENT_PERMISSIONS.WILDCARD),
    // PATCH /:id/close is gated server-side on PO_UPDATE, not a dedicated close permission
    canClose,
    // Same PO_UPDATE gate as canClose: the edit and close PATCH are one endpoint.
    canEdit: canClose,
    // "Receive stock" uses the inventory:receive:create endpoint, so gate on that.
    canReceive:
      can(session, INVENTORY_PERMISSIONS.RECEIVE_CREATE) ||
      can(session, PROCUREMENT_PERMISSIONS.WILDCARD),
    // Unit cost is restricted to Business Owner / Accountant.
    canViewCost: can(session, INVENTORY_PERMISSIONS.RECEIVE_COST_VIEW),
    // Gates the "View Invoice" link so a role without AP Invoices access isn't sent to a denied page.
    canViewApBill:
      can(session, ACCOUNTING_PERMISSIONS.AP_BILLS_READ) ||
      can(session, ACCOUNTING_PERMISSIONS.WILDCARD),
  }
}
