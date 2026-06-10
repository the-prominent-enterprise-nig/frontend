import { api } from '@/src/libs/api/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { SubscriptionForm } from './_components/SubscriptionForm'

interface Subscription {
  id: string
  planCode: string
  status: string
  billingCycle: string
  userLimit: number
  branchLimit: number
  amount: string
  currency: string
  nextBillingDate: string
  startDate?: string | null
  expirationDate?: string | null
  trialEndsAt?: string | null
}

interface EnterpriseBasic {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
}

export default async function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [enterpriseResult, subResult] = await Promise.all([
    api.get<EnterpriseBasic>(`/super-admin/enterprises/${id}`),
    api.get<Subscription>(`/super-admin/enterprises/${id}/subscription`),
  ])

  if (!enterpriseResult.success || !enterpriseResult.data) return notFound()

  const enterprise = enterpriseResult.data
  const name = enterprise.companyTradingName ?? enterprise.companyLegalName

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
        <span className="text-zinc-600">Subscription</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Subscription</h1>
        <p className="text-sm text-zinc-500">
          Manage the subscription plan for{' '}
          <strong className="text-zinc-700 dark:text-zinc-300">{name}</strong>.
        </p>
      </div>

      <SubscriptionForm enterpriseId={id} subscription={subResult.data ?? null} />
    </div>
  )
}
