import { api } from '@/src/libs/api/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { AdminsClient } from './_components/AdminsClient'

interface UserRole {
  role: { name: string }
}

interface Admin {
  id: string
  email: string
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  isActive: boolean
  status: string
  createdAt: string
  lastLoginAt?: string | null
  userRoles: UserRole[]
}

interface EnterpriseBasic {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
}

export default async function AdminsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [enterpriseResult, adminsResult] = await Promise.all([
    api.get<EnterpriseBasic>(`/super-admin/enterprises/${id}`),
    api.get<Admin[]>(`/super-admin/enterprises/${id}/admins`),
  ])

  if (!enterpriseResult.success || !enterpriseResult.data) return notFound()

  const enterprise = enterpriseResult.data
  const name = enterprise.companyTradingName ?? enterprise.companyLegalName
  const admins = adminsResult.data ?? []

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
        <span className="text-zinc-600">Admins</span>
      </nav>

      <AdminsClient enterpriseId={id} admins={admins} />
    </div>
  )
}
