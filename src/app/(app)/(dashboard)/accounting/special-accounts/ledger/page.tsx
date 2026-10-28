import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import SpecialAccountLedgerView from './_components/SpecialAccountLedgerView'

export const metadata = {
  title: 'Special Account Ledger | NIG Central',
}

// Identified by (control account, name) rather than by an id: the balances
// that predate the register have no record of their own, and they are the
// ones with the most history to show.
export default async function SpecialAccountLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; name?: string }>
}) {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.SPECIAL_ACCOUNTS_READ)
  const { accountId, name } = await searchParams
  return <SpecialAccountLedgerView accountId={accountId ?? ''} name={name ?? ''} />
}
