import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { can } from '@/src/libs/guards/permission'
import TaxClosingDetail from './_components/TaxClosingDetail'

export const metadata = { title: 'Tax Closing' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.TAX_CLOSING_READ
  )
  const { id } = await params
  return (
    <TaxClosingDetail
      id={id}
      canReverse={can(session, ACCOUNTING_PERMISSIONS.TAX_CLOSING_REVERSE)}
    />
  )
}
