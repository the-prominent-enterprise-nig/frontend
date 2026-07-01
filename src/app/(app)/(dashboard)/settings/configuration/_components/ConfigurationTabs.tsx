'use client'

import { useState } from 'react'
import { KeyRound, CreditCard } from 'lucide-react'
import { PinSection } from './PinSection'
import { OwnerPaymentMethodsSection } from '@/src/components/settings/OwnerPaymentMethodsSection'
import type { OwnerPaymentMethod } from '@/src/schema/pos'

type Tab = 'pin' | 'payment'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'pin', label: 'POS PIN', icon: KeyRound },
  { id: 'payment', label: 'Payment Methods', icon: CreditCard },
]

export function ConfigurationTabs({
  initialPaymentMethods,
  initialHasPin,
}: {
  initialPaymentMethods: OwnerPaymentMethod[]
  initialHasPin: boolean
}) {
  const [active, setActive] = useState<Tab>('pin')

  return (
    <div>
      {/* Tab strip */}
      <div className="flex border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex items-center gap-2 border-b-2 px-5 py-4 text-sm font-medium transition-colors ${
              active === id
                ? 'border-purple-600 bg-purple-50/40 text-purple-700'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {active === 'pin' && <PinSection initialHasPin={initialHasPin} />}
        {active === 'payment' && (
          <OwnerPaymentMethodsSection initialMethods={initialPaymentMethods} />
        )}
      </div>
    </div>
  )
}
