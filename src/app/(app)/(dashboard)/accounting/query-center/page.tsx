import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import QueryCenter from './_components/QueryCenter'

export const metadata = {
  title: 'Data Query Center | Prominent Enterprise',
  description: 'Read-only raw data from every module, exportable to Excel or CSV',
}

// Scenario 62 — Business Owner only. An exact permission check, not
// requirePermission(): that one wildcard-matches, and the Accountant's
// 'accounting:*' must not reach this page (the backend refuses it too).
export default async function QueryCenterPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!session.permissions.includes(ACCOUNTING_PERMISSIONS.QUERY_CENTER_READ)) redirect('/403')
  return <QueryCenter />
}
