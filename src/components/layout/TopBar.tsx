'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Button, Header } from 'react-aria-components'
import { hasPermission } from '@/src/hooks/usePermission'
import { cn } from '@/src/libs/tailwind-merge/utils'
import { MODULES } from '@/src/libs/guards/modules'
import { Key, Lock, LogOut, ShieldCheck, Users, UserCircle } from 'lucide-react'
import { logoutAndRedirect } from '@/src/libs/auth/actions'
import ChangePasswordModal from '@/src/components/workspace/ChangePasswordModal'
import { usePosPendingRefundStore } from '@/src/stores/pos-pending-refund.store'

interface SessionUser {
  id: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  roles: string[]
  permissions: string[]
  primaryRole?: string
  moduleAccess?: string[]
}

export default function TopBar({ session }: { session: SessionUser | null }) {
  const pathname = usePathname()

  const [notificationCount] = useState(6)
  const [profileOpen, setProfileOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = MODULES.filter((mod) => hasPermission(session, mod.requiredPermission))

  const showAdminDropdown =
    hasPermission(session, 'admin:roles:manage') && session?.primaryRole !== 'Business Owner'
  const displayName = session?.firstName || session?.fullName || session?.email || 'User'
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'

  return (
    <div className="relative">
      <Header className="w-full border-b border-gray-100 bg-white">
        <div className="flex h-14 items-center justify-end px-4 lg:px-6">
          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <Button className="relative cursor-pointer rounded-full p-2 transition-colors hover:bg-gray-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
                />
              </svg>
              {notificationCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.25 min-w-4.25 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {notificationCount}
                </span>
              )}
            </Button>

            {/* Avatar — gradient with profile dropdown */}
            {session && (
              <div className="relative">
                <Button
                  onPress={() => setProfileOpen((v) => !v)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[12px] font-bold tracking-wide text-white shadow-sm transition-opacity hover:opacity-90 prominent-gradient"
                >
                  {initials}
                </Button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                      <div className="border-b border-zinc-100 px-3 py-2.5">
                        <p className="text-sm font-semibold text-zinc-900">{displayName}</p>
                        {session.email && <p className="text-xs text-zinc-400">{session.email}</p>}
                      </div>
                      <Link
                        href="/workspace/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                      >
                        <UserCircle className="h-4 w-4 shrink-0" />
                        View Profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false)
                          setChangePasswordOpen(true)
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 cursor-pointer"
                      >
                        <Lock className="h-4 w-4 shrink-0" />
                        Change Password
                      </button>
                      {showAdminDropdown && (
                        <>
                          <div className="border-t border-zinc-100" />
                          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                            Admin Settings
                          </p>
                          <Link
                            href="/settings/users"
                            onClick={() => setProfileOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors',
                              pathname === '/settings/users'
                                ? 'bg-prominent-orange-50 text-prominent-orange-700'
                                : 'text-zinc-700 hover:bg-zinc-50'
                            )}
                          >
                            <Users className="h-4 w-4 shrink-0" />
                            Users
                          </Link>
                          <Link
                            href="/settings/roles"
                            onClick={() => setProfileOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors',
                              pathname === '/settings/roles'
                                ? 'bg-prominent-orange-50 text-prominent-orange-700'
                                : 'text-zinc-700 hover:bg-zinc-50'
                            )}
                          >
                            <ShieldCheck className="h-4 w-4 shrink-0" />
                            Roles
                          </Link>
                          <Link
                            href="/settings/permissions"
                            onClick={() => setProfileOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors',
                              pathname === '/settings/permissions'
                                ? 'bg-prominent-orange-50 text-prominent-orange-700'
                                : 'text-zinc-700 hover:bg-zinc-50'
                            )}
                          >
                            <Key className="h-4 w-4 shrink-0" />
                            Permissions
                          </Link>
                        </>
                      )}
                      <div className="border-t border-zinc-100" />
                      <button
                        onClick={async () => {
                          setProfileOpen(false)
                          // Persists to localStorage keyed by name only, not by
                          // user — without this it'd leak the previous account's
                          // pending-refund badge into the next login on the same
                          // browser.
                          usePosPendingRefundStore.getState().clear()
                          await logoutAndRedirect()
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Hamburger — mobile only, shown when 2+ modules accessible */}
            {navItems.length > 1 && (
              <Button
                onPress={() => setMobileMenuOpen((prev) => !prev)}
                className="ml-1 flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 md:hidden"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </Button>
            )}
          </div>
        </div>
      </Header>

      {/* Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[-1] md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  )
}
