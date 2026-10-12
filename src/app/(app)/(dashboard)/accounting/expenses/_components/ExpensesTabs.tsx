'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Coins, Repeat } from 'lucide-react'

/**
 * The two lists that live under Expenses: the expenses themselves (where they are filed),
 * and the client's list of recurring expenses (rent, electricity…). Shown on both list
 * pages and nowhere else (not on the forms).
 */
const TABS = [
  {
    href: '/accounting/expenses',
    label: 'Expenses',
    icon: Coins,
    isActive: (p: string) => p === '/accounting/expenses',
  },
  {
    href: '/accounting/expenses/recurring',
    label: 'Recurring',
    icon: Repeat,
    isActive: (p: string) => p.startsWith('/accounting/expenses/recurring'),
  },
]

export default function ExpensesTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Expenses sections" className="mb-5 flex gap-1 border-b border-zinc-200">
      {TABS.map((t) => {
        const active = t.isActive(pathname)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium ${
              active
                ? 'border-prominent-purple-700 text-prominent-purple-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
