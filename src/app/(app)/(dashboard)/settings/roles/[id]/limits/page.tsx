import { redirect, notFound } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { api } from '@/src/libs/api/client'
import type { BankAccountOption } from '@/src/libs/data/AccountingV2Data'
import { getRole } from '../../../_actions'
import { getRoleScopes } from '../../../_actions/role-scopes'
import RoleLimitsClient, { type ControlAccount } from './_components/RoleLimitsClient'

export const metadata = { title: 'Account limits | Roles & Access' }

// Access Levels Part 2: the client sheet's limits on which accounts a role may
// use — bank accounts, an expense's "Paid from", Special Accounts. A full page,
// not a modal, like the rest of Roles & Access.
export default async function RoleLimitsPage({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.JSX.Element> {
  const { id } = await params
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const [role, scopes, banks, controls] = await Promise.all([
    getRole(id),
    getRoleScopes(id),
    api.get<BankAccountOption[]>('/bank-accounts/options'),
    api.get<ControlAccount[]>('/expenses/special-accounts/controls'),
  ])
  if (!role.success || !role.data) notFound()

  return (
    <RoleLimitsClient
      role={{ id: role.data.id, name: role.data.name }}
      initialScopes={scopes.data ?? []}
      bankAccounts={banks.data ?? []}
      controlAccounts={controls.data ?? []}
    />
  )
}
