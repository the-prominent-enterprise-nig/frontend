import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import Customer360 from '../../../crm/customers/[id]/_components/Customer360'

export const metadata = { title: 'Customer | POS' }

/**
 * POS customer detail — the same `Customer360` the CRM side renders, under
 * `scope="pos"` (client request, 2026-09-21: "POS customer view should
 * match CRM customer view", including the Apply for Credit button).
 *
 * This replaced a narrower POS-only screen. Reusing the component rather
 * than porting its sections is the same call `CustomerForm` already makes,
 * and it holds up here because every endpoint behind the view is one a
 * Cashier can already call: `/crm/customers/:id/360` needs only
 * `crm:customers:read` (granted since Scenario 23 — no POS route returns
 * coMakers), the installment schedules are a POS route behind
 * `pos:collections:manage`, and the transaction history is behind
 * `pos:transactions:read`.
 *
 * The gate props below are passed for real rather than hardcoded: a Branch
 * Manager opening this same URL should get the Delete and Schedule reminder
 * actions their role allows, while a Cashier simply doesn't render them.
 * The entry permission stays POS's own, so reaching this page never depends
 * on holding CRM's.
 */
export default async function PosCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.CUSTOMERS_READ)) redirect('/403')

  const { id } = await params

  return (
    <Customer360
      id={id}
      scope="pos"
      // POS's own update permission, not CRM's — the Edit link this drives
      // goes to /pos/customers/:id/edit.
      canEdit={can(session, POS_PERMISSIONS.CUSTOMERS_UPDATE)}
      canDelete={can(session, CRM_PERMISSIONS.CUSTOMERS_DELETE)}
      canScheduleReminder={can(session, CRM_PERMISSIONS.REMINDERS_CREATE)}
      canApplyForCredit={can(session, CREDIT_PERMISSIONS.APPLICATION_CREATE)}
      currentUserId={session.id}
      tenantId={session.enterpriseOwnerId ?? session.id}
    />
  )
}
