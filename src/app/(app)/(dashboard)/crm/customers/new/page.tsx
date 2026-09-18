import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import CustomerForm from '../_components/CustomerForm'

export const metadata = { title: 'New Customer | CRM' }

/**
 * Only same-origin absolute paths are honoured as a post-create
 * destination. A raw query param reaching router.push() would otherwise be
 * an open redirect: '//evil.com' and 'https://evil.com' are both valid
 * router.push() targets, and backslashes are normalised to '/' by some
 * browsers, so those shapes are rejected rather than sanitised.
 */
function safeReturnTo(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith('/')) return undefined
  if (raw.startsWith('//')) return undefined
  if (raw.includes('\\')) return undefined
  return raw
}

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.CUSTOMERS_CREATE)) redirect('/403')

  const { returnTo } = await searchParams

  return <CustomerForm returnTo={safeReturnTo(returnTo)} />
}
