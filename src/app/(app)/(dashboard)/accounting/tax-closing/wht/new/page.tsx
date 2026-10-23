import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import WhtRemittanceForm from './_components/WhtRemittanceForm'

export const metadata = { title: 'Remit Withholding Tax' }
export default async function Page() {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.TAX_CLOSING_CREATE)
  return <WhtRemittanceForm />
}
