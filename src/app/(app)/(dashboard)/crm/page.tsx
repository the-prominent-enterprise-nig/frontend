import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import CrmDashboard from './_components/CrmDashboard'

export const metadata = { title: 'CRM' }

export default async function CrmDashboardPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  // This page had no guard of its own until 2026-09-18 — it relied entirely
  // on the /crm layout's ModuleGuard, which was fine while only CRM-wide
  // roles could reach the module at all. Cashier now has the crm module
  // (for Customers), so the dashboard needs its own gate: it surfaces
  // leads, pipeline, segments and collection reminders, none of which a
  // Cashier holds a permission for. Gated on the same permission the
  // sidebar's own "CRM Dashboard" item checks.
  if (!can(session, CRM_PERMISSIONS.LEADS_READ)) {
    // The CRM module tab points here, so a Cashier clicking "CRM" would
    // otherwise hit a dead 403. Send them to the one CRM page they do have,
    // rather than punishing them for using the nav.
    if (can(session, CRM_PERMISSIONS.CUSTOMERS_READ)) redirect('/crm/customers')
    redirect('/403')
  }

  return <CrmDashboard />
}
