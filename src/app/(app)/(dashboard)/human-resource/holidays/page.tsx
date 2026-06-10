import { Sun } from 'lucide-react'
import HolidayCalendar from './_components/HolidayCalendar'
import { getEnterpriseBranches } from './_actions/holiday-actions'

export default async function HolidaysPage() {
  const branchesResult = await getEnterpriseBranches()
  const branches = branchesResult.success ? (branchesResult.data ?? []) : []

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white px-6 py-6">
        <div className="flex items-center gap-3">
          <Sun className="h-6 w-6 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Holiday Calendar</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Manage enterprise-wide and branch-specific holidays with pay multipliers
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <HolidayCalendar branches={branches} />
      </div>
    </div>
  )
}
