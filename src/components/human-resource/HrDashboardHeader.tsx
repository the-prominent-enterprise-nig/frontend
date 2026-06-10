export default function HrDashboardHeader() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-500">Admin Panel</p>
        <h1 className="text-3xl font-semibold text-zinc-900">Human Resources</h1>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          Manage HR modules, attendance records, payroll-related data, employee documents, and
          timekeeping settings from one place.
        </p>
      </div>
    </div>
  )
}
