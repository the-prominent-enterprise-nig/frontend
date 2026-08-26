import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import JournalEntryDetail from './_components/JournalEntryDetail'

export const metadata = { title: 'Journal Entry Detail' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.JOURNAL_ENTRY_READ)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <JournalEntryDetail id={id} />
    </div>
  )
}
