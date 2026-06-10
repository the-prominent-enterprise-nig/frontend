'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  RefreshCw,
  User,
  CreditCard,
  Landmark,
  PhoneCall,
  DollarSign,
  FileText,
  CalendarClock,
  Palmtree,
} from 'lucide-react'
import {
  PersonalInfoSection,
  GovernmentIDsSection,
  BankAccountsSection,
  EmergencyContactsSection,
  PayrollSetupSection,
} from '.'
import { useQuery } from '@tanstack/react-query'
import { getEmployeeById } from '@/src/app/(app)/(dashboard)/human-resource/employees/_actions/fetch-details'
import { useRouter } from 'next/navigation'

export type DetailSection =
  | 'personal'
  | 'government-ids'
  | 'bank-accounts'
  | 'emergency-contacts'
  | 'payroll-setup'

const SECTION_LABELS: Record<DetailSection, string> = {
  personal: 'Personal info',
  'government-ids': "Gov't IDs",
  'bank-accounts': 'Bank accounts',
  'emergency-contacts': 'Emergency contacts',
  'payroll-setup': 'Payroll setup',
}

const NAV_GROUPS = [
  {
    label: 'Profile',
    items: [
      { id: 'personal' as DetailSection, label: 'Personal info', icon: User },
      { id: 'government-ids' as DetailSection, label: "Gov't IDs", icon: CreditCard },
      { id: 'bank-accounts' as DetailSection, label: 'Bank accounts', icon: Landmark },
      { id: 'emergency-contacts' as DetailSection, label: 'Emergency contacts', icon: PhoneCall },
    ],
  },
  {
    label: 'Compensation',
    items: [{ id: 'payroll-setup' as DetailSection, label: 'Payroll setup', icon: DollarSign }],
  },
]

const FUTURE_ITEMS = [
  { label: 'Payroll history', icon: FileText },
  { label: 'Files & documents', icon: FileText },
  { label: 'Attendance logs', icon: CalendarClock },
  { label: 'Leave history', icon: Palmtree },
]

interface Props {
  id: string
  showBackButton?: boolean
  showRefreshButton?: boolean
  visibleSections?: DetailSection[]
}

export function EmployeeDetailShell({
  id,
  showBackButton = true,
  showRefreshButton = true,
  visibleSections,
}: Props) {
  const router = useRouter()
  const allSections: DetailSection[] = [
    'personal',
    'government-ids',
    'bank-accounts',
    'emergency-contacts',
    'payroll-setup',
  ]
  const sections = visibleSections && visibleSections.length > 0 ? visibleSections : allSections
  const [activeSection, setActiveSection] = useState<DetailSection>(sections[0])

  const {
    data: employee,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployeeById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message === 'Employee not found') return false
      return failureCount < 2
    },
  })

  const goBack = () => router.back()

  const initials = employee?.data
    ? `${employee.data.firstName?.[0] ?? ''}${employee.data.lastName?.[0] ?? ''}`.toUpperCase()
    : '??'

  const fullName = employee?.data
    ? [employee.data.firstName, employee.data.lastName].filter(Boolean).join(' ')
    : ''

  const isActive = employee?.data?.status?.toLowerCase() === 'active'

  return (
    <div className="w-full min-h-full bg-gray-50 p-4 pb-24 md:pb-8 md:p-6 lg:p-8">
      <div className="max-w-8xl mx-auto">
        {/* Page header */}
        <div className="mb-4 flex items-center justify-between">
          {showBackButton && (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to masterlist
            </button>
          )}
          {showRefreshButton && (
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-800 font-medium">Failed to load employee</p>
                <p className="text-red-600 text-sm mt-1">
                  {error instanceof Error ? error.message : 'Please try again.'}
                </p>
              </div>
              <button
                onClick={() => refetch()}
                className="text-red-600 hover:text-red-800 font-medium text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Shell */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-150">
          {isLoading ? (
            <div className="flex min-h-150 animate-pulse">
              {/* Sidebar skeleton */}
              <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-gray-200">
                {/* Avatar + name block */}
                <div className="flex flex-col items-center gap-2 px-4 pt-5 pb-4 border-b border-gray-200">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                  <div className="w-28 h-3 bg-gray-200 rounded" />
                  <div className="w-16 h-2.5 bg-gray-200 rounded" />
                  <div className="w-12 h-4 bg-gray-200 rounded-full" />
                </div>
                {/* Nav items */}
                <div className="flex-1 py-4 px-3 space-y-1">
                  <div className="w-16 h-2 bg-gray-200 rounded mb-3" />
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-2">
                      <div className="w-3.5 h-3.5 bg-gray-200 rounded" />
                      <div className="h-2.5 bg-gray-200 rounded w-24" />
                    </div>
                  ))}
                  <div className="border-t border-gray-200 my-3" />
                  <div className="w-14 h-2 bg-gray-200 rounded mb-3" />
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-2">
                      <div className="w-3.5 h-3.5 bg-gray-200 rounded" />
                      <div className="h-2.5 bg-gray-200 rounded w-20" />
                    </div>
                  ))}
                </div>
              </aside>

              {/* Content skeleton */}
              <div className="flex-1 px-6 py-6 space-y-6">
                <div className="w-36 h-4 bg-gray-200 rounded" />
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="h-2.5 bg-gray-200 rounded w-24" />
                      <div className="h-4 bg-gray-200 rounded w-40" />
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <div className="w-32 h-4 bg-gray-200 rounded" />
                  <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="h-2.5 bg-gray-200 rounded w-20" />
                        <div className="h-4 bg-gray-200 rounded w-36" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : employee?.data ? (
            <div className="flex h-full min-h-150">
              <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-gray-200 overflow-y-auto">
                {/* Profile block */}
                <div className="flex flex-col items-center gap-2 px-4 pt-5 pb-4 border-b border-gray-200">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-base font-medium text-purple-700 shrink-0">
                    {initials}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{fullName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{employee.data.employeeCode}</p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Section nav */}
                <nav className="flex-1 py-2 px-2">
                  {NAV_GROUPS.map((group) => {
                    const filteredItems = group.items.filter(({ id: sectionId }) =>
                      sections.includes(sectionId)
                    )

                    if (filteredItems.length === 0) {
                      return null
                    }

                    return (
                      <div key={group.label} className="mb-1">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest px-2 pt-3 pb-1">
                          {group.label}
                        </p>
                        {filteredItems.map(({ id: sectionId, label, icon: Icon }) => (
                          <button
                            key={sectionId}
                            onClick={() => setActiveSection(sectionId)}
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs text-left transition-colors cursor-pointer ${
                              activeSection === sectionId
                                ? 'bg-purple-50 text-purple-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            {label}
                          </button>
                        ))}
                      </div>
                    )
                  })}

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-2" />

                  {/* Future items */}
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest px-2 pt-1 pb-1">
                      Records
                    </p>
                    {FUTURE_ITEMS.map(({ label, icon: Icon }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 px-2 py-2 rounded-md text-xs text-gray-300 cursor-not-allowed"
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1">{label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full">
                          soon
                        </span>
                      </div>
                    ))}
                  </div>
                </nav>
              </aside>

              {/* ── Main content ── */}
              <div className="flex-1 flex flex-col overflow-hidden py-3">
                {/* Mobile pill tabs */}
                <div className="md:hidden flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-gray-200 bg-gray-50">
                  {sections.map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSection(s)}
                      className={`shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors cursor-pointer ${
                        activeSection === s
                          ? 'bg-purple-700 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {SECTION_LABELS[s]}
                    </button>
                  ))}
                </div>

                {/* Section content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col">
                  {activeSection === 'personal' && <PersonalInfoSection employee={employee.data} />}
                  {activeSection === 'government-ids' && (
                    <GovernmentIDsSection employee={employee.data} />
                  )}
                  {activeSection === 'bank-accounts' && (
                    <BankAccountsSection employee={employee.data} />
                  )}
                  {activeSection === 'emergency-contacts' && (
                    <EmergencyContactsSection employee={employee.data} />
                  )}
                  {activeSection === 'payroll-setup' && (
                    <PayrollSetupSection employee={employee.data} className="flex-1" />
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
