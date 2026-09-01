import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import AgingReportView from './_components/AgingReportView'

export const metadata = { title: 'AR Aging Report | CRM' }

export default async function AgingReportPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  // Matches the backend route's OR permission (installment-account.controller.ts)
  // — Accountant holds only accounting:*, no crm:* at all, but this report is
  // exactly what they need, so either permission is accepted here too.
  const allowed =
    can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_READ) ||
    can(session, ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ)
  if (!allowed) redirect('/403')

  return <AgingReportView />
}
