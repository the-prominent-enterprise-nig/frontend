import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import CustomerLedgerView from '@/src/components/crm/CustomerLedgerView'

export const metadata = { title: 'Customer Ledger | POS' }

/**
 * POS customer ledger — the same `CustomerLedgerView` CRM renders, reached
 * through a POS address so a cashier can answer "how much have I paid
 * already?" at the counter. Until now the POS customer view could show what
 * was still DUE (Upcoming Payables) but not what had been paid.
 *
 * No new data is exposed by this page. `GET /crm/customers/:id/ledger` is
 * gated on `crm:customers:read`, which a Cashier has held since Scenario 23
 * — the block was never the data, only that the CRM *page* address bounces
 * off /403 for a role confined to the `pos` module by ROLE_MODULE_ACCESS.
 * Same one-component-two-doors treatment as CustomerForm and Customer360.
 *
 * Deliberately read-only (2026-09-21): `canEdit` is hardcoded false rather
 * than wired to a permission. CRM's own ledger passes
 * `crm:customers:update`, which a Cashier also holds — so passing the real
 * check here would have handed every cashier the ledger's edit controls as
 * a side effect of adding a link. A till needs to READ the payment history,
 * not revise it. Wire this to a real permission only if editing from POS is
 * ever actually asked for.
 */
export default async function PosCustomerLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.CUSTOMERS_READ)) redirect('/403')

  const { id } = await params
  return (
    <div className="min-h-screen bg-zinc-50">
      <CustomerLedgerView
        customerId={id}
        backHref={`/pos/customers/${id}`}
        backLabel="Back to customer"
        canEdit={false}
      />
    </div>
  )
}
