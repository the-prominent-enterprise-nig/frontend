'use client'

import { useState } from 'react'
import LeaveRequestList from '@/src/components/human-resource/LeaveRequestList'

export default function LeavePage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full">
        <div className="border-b border-zinc-200 bg-white px-6 py-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Leave Management</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Review and manage employee leave requests
          </p>
        </div>
        <LeaveRequestList key={refreshKey} onRequestsUpdated={() => setRefreshKey((k) => k + 1)} />
      </main>
    </div>
  )
}
