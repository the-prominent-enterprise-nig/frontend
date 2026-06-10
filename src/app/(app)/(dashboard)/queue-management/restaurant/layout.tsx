'use client'

import Link from 'next/link'
import { UtensilsCrossed, Settings, ArrowLeft } from 'lucide-react'
import { useRestaurantConfig } from '@/src/libs/hooks/useRestaurantConfig'

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const { data: config, isLoading } = useRestaurantConfig()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (config?.mode !== 'RESTAURANT') {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 sm:p-12 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Restaurant mode is off</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enable Restaurant mode in Queue Settings to access tables, kitchen display, bookings,
            and server sections.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/queue-management"
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Queue
            </Link>
            <Link
              href="/queue-management/settings"
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" /> Enable in Settings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
