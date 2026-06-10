import { api } from '@/src/libs/api/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { EditEnterpriseForm } from './_components/EditEnterpriseForm'

interface EnterpriseBasic {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
  contactPerson?: string | null
  mobileNumber?: string | null
  industry: string
  country: string
  timezone?: string | null
}

export default async function EditEnterprisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await api.get<EnterpriseBasic>(`/super-admin/enterprises/${id}`)
  if (!result.success || !result.data) return notFound()
  const e = result.data
  const name = e.companyTradingName ?? e.companyLegalName

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
        <span className="text-zinc-600">Edit</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edit Business</h1>
        <p className="text-sm text-zinc-500">Update details for {name}.</p>
      </div>

      <EditEnterpriseForm enterprise={e} />
    </div>
  )
}
