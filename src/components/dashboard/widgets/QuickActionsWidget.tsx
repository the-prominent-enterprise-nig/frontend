import Link from 'next/link'
import { UserPlus, FileText, BarChart2, Settings, ShoppingCart, Package } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { useWidgetConfig } from '../WidgetSizeContext'
import type { QuickActionsSettings } from '@/src/libs/dashboardWidgets'

export const QUICK_ACTIONS = [
  {
    id: 'new-sale',
    label: 'New Sale',
    icon: ShoppingCart,
    href: '/point-of-sale/checkout',
    color: 'bg-green-100 text-green-700 hover:bg-green-200',
  },
  {
    id: 'new-invoice',
    label: 'New Invoice',
    icon: FileText,
    href: '/accounting/invoices/new',
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  },
  {
    id: 'add-customer',
    label: 'Add Customer',
    icon: UserPlus,
    href: '/crm/customers/new',
    color: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  },
  {
    id: 'view-reports',
    label: 'View Reports',
    icon: BarChart2,
    href: '/accounting/reports',
    color: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  },
  {
    id: 'stock-receive',
    label: 'Receive Stock',
    icon: Package,
    href: '/inventory/receiving',
    color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
  },
] as const

export default function QuickActionsWidget() {
  const { variant } = useWidgetSize()
  const { settings } = useWidgetConfig()
  const s = settings as Partial<QuickActionsSettings>
  const enabledIds = s.enabledActions ?? QUICK_ACTIONS.map((a) => a.id)
  const visibleActions = QUICK_ACTIONS.filter((a) => enabledIds.includes(a.id))

  // xs (<250px) and sm (250–390px): compact single-column list
  // md/lg (390+px): 2-column icon grid
  if (variant === 'xs' || variant === 'sm') {
    const limit = variant === 'xs' ? Math.min(4, visibleActions.length) : visibleActions.length
    return (
      <div className="flex flex-col gap-1">
        {visibleActions.slice(0, limit).map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.id}
              href={action.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition ${action.color}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{action.label}</span>
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {visibleActions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.id}
            href={action.href}
            className={`flex min-w-0 flex-col items-center gap-1 overflow-hidden rounded-xl p-2.5 text-center transition ${action.color}`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="w-full truncate text-[10px] font-medium leading-tight">{action.label}</p>
          </Link>
        )
      })}
    </div>
  )
}
