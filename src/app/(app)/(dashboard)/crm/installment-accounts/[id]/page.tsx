import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { REMINDERS_ENABLED } from '@/src/libs/features'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import InstallmentAccountDetail from './_components/InstallmentAccountDetail'

export const metadata = { title: 'Installment Account | CRM' }

export default async function InstallmentAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_READ)) redirect('/403')

  const { id } = await params
  return (
    <InstallmentAccountDetail
      id={id}
      canEdit={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_UPDATE)}
      canEarlyPayoff={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_EARLY_PAYOFF)}
      // Record payment opens POS Collections (POS-sale plan) or AR New
      // Receipt (imported account), each with its own guard — so the button
      // needs the CRM permission plus that screen's, or it leads to a 403.
      canCollectAtPos={
        can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_RECORD_PAYMENT) &&
        can(session, POS_PERMISSIONS.COLLECTIONS_MANAGE)
      }
      canRecordReceipt={
        can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_RECORD_PAYMENT) &&
        can(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ) &&
        can(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_PAY)
      }
      canApproveGraduation={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_APPROVE_GRADUATION)}
      canApproveDamEscalation={can(
        session,
        CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_APPROVE_DAM_ESCALATION
      )}
      canManageLegalEscalation={can(
        session,
        CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_MANAGE_LEGAL_ESCALATION
      )}
      canScheduleReminder={REMINDERS_ENABLED && can(session, CRM_PERMISSIONS.REMINDERS_CREATE)}
      canViewCommission={can(session, CRM_PERMISSIONS.AGENTS_READ)}
      currentUserId={session.id}
      tenantId={session.enterpriseOwnerId ?? session.id}
    />
  )
}
