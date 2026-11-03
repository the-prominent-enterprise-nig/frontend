import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { OffsetRetentionForm } from '../_components/RetentionForms'

export const metadata = { title: 'Offset Retention' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.RETENTION_ADJUST)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <OffsetRetentionForm id={id} />
    </div>
  )
}
