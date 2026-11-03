import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import IncomeTaxClosingForm from './_components/IncomeTaxClosingForm'

export const metadata = { title: 'Close Income Tax' }
export default async function Page() {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.TAX_CLOSING_CREATE)
  return <IncomeTaxClosingForm />
}
