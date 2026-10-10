import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import VatSettlementForm from './_components/VatSettlementForm'

export const metadata = { title: 'Settle VAT' }
export default async function Page() {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.TAX_CLOSING_CREATE)
  return <VatSettlementForm />
}
