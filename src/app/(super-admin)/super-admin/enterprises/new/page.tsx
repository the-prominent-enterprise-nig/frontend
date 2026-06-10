import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CreateEnterpriseForm } from './_components/CreateEnterpriseForm'

export const metadata = {
  title: 'New Business — TPE Admin',
}

export default function NewEnterprisePage() {
  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-zinc-400">
        <Link
          href="/super-admin/enterprises"
          className="hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          Businesses
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="text-zinc-700 dark:text-zinc-300">New Business</span>
      </nav>

      {/* Page title */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">New Business</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Set up a new tenant business and invite its owner to the platform.
        </p>
      </div>

      <CreateEnterpriseForm />
    </div>
  )
}
