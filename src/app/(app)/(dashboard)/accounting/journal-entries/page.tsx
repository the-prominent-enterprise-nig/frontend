import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import JournalEntriesList from './_components/JournalEntriesList'

export const metadata = {
  title: 'Journal Entries | Prominent Enterprise',
}

export default async function JournalEntriesPage() {
  const session = await getSessionOrNull()
  const user = requirePermission(session, ACCOUNTING_PERMISSIONS.JOURNAL_ENTRY_READ)

  return (
    <div className="min-h-screen bg-gray-50">
      <JournalEntriesList session={user} />
    </div>
  )
}
