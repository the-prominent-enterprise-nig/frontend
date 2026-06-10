import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import JournalEntriesList from './_components/JournalEntriesList'

export const metadata = {
  title: 'Journal Entries | Prominent Enterprise',
}

export default async function JournalEntriesPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <JournalEntriesList session={session} />
    </div>
  )
}
