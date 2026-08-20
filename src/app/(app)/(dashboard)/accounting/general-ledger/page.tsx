import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import GeneralLedgerView from './_components/GeneralLedgerView'

export const metadata = {
  title: 'General Ledger | Prominent Enterprise',
  description: 'Every posted journal entry line, with running balances per account',
}

export default async function GeneralLedgerPage() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.GENERAL_LEDGER_READ)
  return <GeneralLedgerView />
}
