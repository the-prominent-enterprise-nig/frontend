'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePosOverridePendingCount } from '../_hooks/usePosOverridePendingCount'
import { isPosTabActive, posNavModel, resolvePosTabHref } from '../_shared/pos-hubs'

// Where the tabs come from: _shared/pos-hubs.ts. Pages no hub owns — Product
// Catalog, Customers, and the detail and form pages inside a hub — show no strip.

type NavProps = {
  canConfigurePos: boolean
  /** Hrefs of the pages this user may open — worked out on the server, where the permissions are. */
  visibleHrefs: string[]
}

const TAB_BASE =
  'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium whitespace-nowrap transition-colors md:px-4'
const TAB_ACTIVE = 'border-purple-600 text-purple-700'
const TAB_IDLE = 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'

export function PosNav({ canConfigurePos, visibleHrefs }: NavProps) {
  const pathname = usePathname()
  const model = posNavModel(pathname, visibleHrefs, canConfigurePos)

  const overrideTab = model?.tabs.find((tab) => tab.id === 'override-review')
  const overridePending = usePosOverridePendingCount(!!overrideTab)

  if (!model) return null

  // A strip with one tab has nothing to switch to — the sidebar item already
  // says where you are. But when that one tab fronts a second row (Promotions),
  // the second row is the only navigation there is, so it takes the strip's place.
  if (model.tabs.length < 2) {
    if (model.subTabs.length < 2) return null
    return (
      <nav
        aria-label="POS section tabs"
        className="flex min-w-0 flex-1 items-center overflow-x-auto bg-white px-4 lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {model.subTabs.map((sub) => (
          <Link
            key={sub.href}
            href={sub.href}
            className={`${TAB_BASE} ${pathname === sub.href ? TAB_ACTIVE : TAB_IDLE}`}
          >
            <sub.icon className="h-3.5 w-3.5" />
            {sub.label}
          </Link>
        ))}
      </nav>
    )
  }

  return (
    <nav
      aria-label="POS section tabs"
      className="flex min-w-0 flex-1 items-center overflow-x-auto bg-white px-4 lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {model.tabs.map((tab) => {
        const href = resolvePosTabHref(tab, visibleHrefs)
        if (!href) return null
        const badge = tab === overrideTab && overridePending > 0 ? overridePending : 0
        return (
          <Link
            key={tab.id}
            href={href}
            className={`${TAB_BASE} ${isPosTabActive(tab, pathname) ? TAB_ACTIVE : TAB_IDLE}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {badge > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold leading-none text-white">
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * The second row, under the strip: the pages of the lit tab that fronts one
 * (Management → Sessions | Cash Drawer). Only when the strip itself is showing —
 * with a lone tab, PosNav draws these pages in the strip's place instead.
 */
export function PosSubNav({ canConfigurePos, visibleHrefs }: NavProps) {
  const pathname = usePathname()
  const model = posNavModel(pathname, visibleHrefs, canConfigurePos)

  if (!model || model.tabs.length < 2 || model.subTabs.length < 2) return null

  return (
    <nav
      aria-label="POS sub tabs"
      className="flex min-w-0 items-center gap-1.5 overflow-x-auto border-b border-gray-100 bg-gray-50/70 px-4 py-2 lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {model.subTabs.map((sub) => (
        <Link
          key={sub.href}
          href={sub.href}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
            pathname === sub.href
              ? 'bg-purple-100 text-purple-700'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
          }`}
        >
          <sub.icon className="h-3 w-3" />
          {sub.label}
        </Link>
      ))}
    </nav>
  )
}
