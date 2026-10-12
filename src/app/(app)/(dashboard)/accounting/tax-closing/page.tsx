import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { can } from '@/src/libs/guards/permission'
import TaxClosingList from './_components/TaxClosingList'

export const metadata = { title: 'Tax Closing' }
export default async function Page() {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.TAX_CLOSING_READ
  )
  return <TaxClosingList canCreate={can(session, ACCOUNTING_PERMISSIONS.TAX_CLOSING_CREATE)} />
}
