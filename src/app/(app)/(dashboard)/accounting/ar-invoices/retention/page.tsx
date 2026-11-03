import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import RetentionSchedule from './_components/RetentionSchedule'

export const metadata = { title: 'Customer Retention' }
export default async function Page() {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <RetentionSchedule />
    </div>
  )
}
