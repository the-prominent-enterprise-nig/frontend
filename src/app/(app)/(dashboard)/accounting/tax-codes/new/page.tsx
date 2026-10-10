import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import TaxCodeForm from './_components/TaxCodeForm'

export const metadata = { title: 'New Tax Code' }
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.TAX_CODES_CREATE)
  const { code } = await searchParams
  return <TaxCodeForm versionOf={code ? decodeURIComponent(code) : undefined} />
}
