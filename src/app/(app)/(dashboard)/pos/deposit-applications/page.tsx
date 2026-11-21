import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import DepositApplicationsList from './_components/DepositApplicationsList'

export const metadata = {
  title: 'Deposit Applications | NIG Central',
}

// Docket NIG #91 — requests to apply a customer's deposit to an aging account.
// Head Office AR (apply) sees and cancels its own requests; the Approver
// (approve) decides them.
export default async function DepositApplicationsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  const canApply = can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_APPLY_DEPOSIT)
  const canApprove = can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_APPROVE_DEPOSIT)
  if (!canApply && !canApprove) redirect('/403')

  return <DepositApplicationsList canApply={canApply} canApprove={canApprove} />
}
