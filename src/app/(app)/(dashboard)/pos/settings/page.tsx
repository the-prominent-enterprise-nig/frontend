import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import Link from 'next/link'
import {
  Monitor,
  GitBranch,
  BookOpen,
  Tag,
  Gift,
  Star,
  ArrowRight,
  Tv2,
  Settings,
  Palette,
} from 'lucide-react'

export const metadata = { title: 'POS Settings' }

const sections = [
  {
    label: 'General Configuration',
    description: 'Discount thresholds, return windows, and stock check behaviour.',
    href: '/pos/config',
    icon: Settings,
  },
  {
    label: 'Receipt Branding',
    description: 'Upload your business logo and set brand colors on receipts.',
    href: '/pos/receipt-branding',
    icon: Palette,
  },
  {
    label: 'Terminals',
    description: 'Add, edit, and deactivate POS terminals.',
    href: '/pos/terminals',
    icon: Monitor,
  },
  {
    label: 'GL Account Mapping',
    description: 'Map payment methods to general ledger accounts.',
    href: '/pos/gl-mapping',
    icon: BookOpen,
  },
  {
    label: 'Branch Pricing',
    description: 'Override item prices per branch.',
    href: '/pos/branch-pricing',
    icon: GitBranch,
  },
  {
    label: 'Promo Codes',
    description: 'Create and manage promotional discount codes.',
    href: '/pos/promo-codes',
    icon: Tag,
  },
  {
    label: 'Gift Cards',
    description: 'Issue and manage gift card balances.',
    href: '/pos/gift-cards',
    icon: Gift,
  },
  {
    label: 'Loyalty Program',
    description: 'Configure points earning and redemption rules.',
    href: '/pos/loyalty',
    icon: Star,
  },
  {
    label: 'Customer Display',
    description: 'Live order summary for customer-facing screen.',
    href: '/pos/customer-display',
    icon: Tv2,
  },
]

export default async function PosSettingsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.WILDCARD)) redirect('/403')

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure your Point of Sale system — terminals, pricing, promotions, and integrations.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
          {sections.map(({ label, description, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Icon size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <ArrowRight size={16} className="shrink-0 text-gray-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
