'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { logoutAndRedirect } from '@/src/libs/auth/actions'

interface NavSection {
  label: string
  items: {
    label: string
    href: string
    icon: React.ElementType
    matchPrefix?: string
  }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Businesses',
    items: [
      {
        label: 'Businesses',
        href: '/super-admin/enterprises',
        icon: Building2,
        matchPrefix: '/super-admin/enterprises',
      },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Audit Logs', href: '/super-admin/audit-logs', icon: ClipboardList },
      { label: 'System Health', href: '/super-admin/health', icon: Activity },
    ],
  },
]

export function SuperAdminSideBar({ email }: { email: string }) {
  const pathname = usePathname()

  function isActive(href: string, matchPrefix?: string): boolean {
    if (matchPrefix) return pathname.startsWith(matchPrefix)
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col bg-slate-950">
      {/* Logo */}
      <div className="flex flex-col gap-0.5 border-b border-slate-800 px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-indigo-400">TPE Platform</span>
        </div>
        <p className="pl-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-500">
          Platform Administration
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href, item.matchPrefix)
                  return (
                    <li key={item.href + item.label}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 border-l-2 py-2 pl-2 pr-3 text-sm font-medium transition-colors ${
                          active
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 px-2">
          <p className="text-[10px] text-slate-500">Signed in as</p>
          <p className="truncate text-xs font-medium text-slate-300">{email}</p>
        </div>
        <form action={logoutAndRedirect}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-200"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
