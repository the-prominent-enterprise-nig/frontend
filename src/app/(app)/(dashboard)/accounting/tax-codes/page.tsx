import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { can } from '@/src/libs/guards/permission'
import TaxCodesList from './_components/TaxCodesList'

export const metadata = { title: 'Tax Codes' }
export default async function Page() {
  const session = requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.TAX_CODES_READ)
  return <TaxCodesList canCreate={can(session, ACCOUNTING_PERMISSIONS.TAX_CODES_CREATE)} />
}
