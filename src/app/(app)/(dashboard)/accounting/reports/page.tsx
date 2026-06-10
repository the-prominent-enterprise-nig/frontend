import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import ReportsHub from './_components/ReportsHub'

export const metadata = { title: 'Reports | Prominent Enterprise' }

export default async function ReportsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={<div className="p-6 text-sm text-gray-400 animate-pulse">Loading reports…</div>}
      >
        <ReportsHub />
      </Suspense>
    </div>
  )
}
