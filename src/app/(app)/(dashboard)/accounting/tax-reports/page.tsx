import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { can } from '@/src/libs/guards/permission'
import TaxReportsHub from './_components/TaxReportsHub'

export const metadata = { title: 'Tax Reports' }
export default async function Page() {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ
  )
  return <TaxReportsHub canClose={can(session, ACCOUNTING_PERMISSIONS.TAX_CLOSING_CREATE)} />
}
