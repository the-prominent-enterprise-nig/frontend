import { api } from '@/src/libs/api/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { ModuleAssignmentForm } from './_components/ModuleAssignmentForm'

interface ModulesResponse {
  enabledModules: string[]
}

interface EnterpriseBasic {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
}

export default async function ModulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [enterpriseResult, modulesResult] = await Promise.all([
    api.get<EnterpriseBasic>(`/super-admin/enterprises/${id}`),
    api.get<ModulesResponse>(`/super-admin/enterprises/${id}/modules`),
  ])

  if (!enterpriseResult.success || !enterpriseResult.data) return notFound()

  const enterprise = enterpriseResult.data
  const name = enterprise.companyTradingName ?? enterprise.companyLegalName
  const enabledModules = modulesResult.data?.enabledModules ?? []

  return (
    <div className="p-6">
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-zinc-400">
        <Link href="/super-admin/enterprises" className="hover:text-zinc-600">
          Businesses
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/super-admin/enterprises/${id}`} className="hover:text-zinc-600">
          {name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-zinc-600">Modules</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Module Access</h1>
        <p className="text-sm text-zinc-500">
          Control which modules are available to{' '}
          <strong className="text-zinc-700 dark:text-zinc-300">{name}</strong>. Disabled modules
          will be hidden from the sidebar.
        </p>
      </div>

      <ModuleAssignmentForm enterpriseId={id} initialModules={enabledModules} />
    </div>
  )
}
