import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { can } from '@/src/libs/guards/permission'
import TaxCodeDetail from './_components/TaxCodeDetail'

export const metadata = { title: 'Tax Code' }
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const session = requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.TAX_CODES_READ)
  const { code } = await params
  const { saved } = await searchParams
  return (
    <TaxCodeDetail
      code={decodeURIComponent(code)}
      canEdit={can(session, ACCOUNTING_PERMISSIONS.TAX_CODES_UPDATE)}
      canAddVersion={can(session, ACCOUNTING_PERMISSIONS.TAX_CODES_CREATE)}
      justSaved={saved === '1'}
    />
  )
}
