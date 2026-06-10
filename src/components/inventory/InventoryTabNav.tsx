'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

export type InventoryTab = {
  id: string
  label: string
  icon?: LucideIcon
}

// Must be rendered inside a <Suspense> boundary (provided by each hub's page.tsx)
export function InventoryTabNav({ tabs }: { tabs: InventoryTab[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? tabs[0].id

  return (
    <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
      <nav className="-mb-px flex overflow-x-auto px-4 md:px-6" aria-label="Module tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <Link
              key={tab.id}
              href={`${pathname}?tab=${tab.id}`}
              scroll={false}
              replace
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium whitespace-nowrap transition-colors md:px-4 ${
                isActive
                  ? 'border-prominent-orange-600 text-prominent-orange-700'
                  : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
              }`}
            >
              {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
