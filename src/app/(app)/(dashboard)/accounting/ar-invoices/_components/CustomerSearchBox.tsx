'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, User } from 'lucide-react'
import { ARInvoices, type ARInvoiceCustomerResult } from '@/src/libs/data/AccountingV2Data'

/**
 * Live customer search on the AR Invoices screens: pick a result to open that
 * customer's own invoice page. Debounced, same pattern as the POS checkout
 * page's customer picker. Scoped to accounting:ar-invoices:read
 * (ARInvoices.searchCustomers), not the CRM customer list — Accountant
 * (accounting:* only) doesn't hold crm:customers:read, which silently broke
 * this before.
 */
export function CustomerSearchBox(): React.JSX.Element {
  const router = useRouter()
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<ARInvoiceCustomerResult[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      setCustomerSearchOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      const res = await ARInvoices.searchCustomers(customerSearch.trim())
      setCustomerResults(res.data ?? [])
      setCustomerSearchOpen(true)
      setSearchingCustomers(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  return (
    <div className="relative min-w-56 flex-1">
      <label className="mb-1 block text-xs font-semibold text-gray-600">Customer</label>
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-purple-500 focus:outline-none"
          placeholder="Search by name or phone…"
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
          onFocus={() => customerResults.length > 0 && setCustomerSearchOpen(true)}
        />
        {searchingCustomers && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
          />
        )}
      </div>
      {customerSearchOpen && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {customerResults.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No customers found</p>
          ) : (
            customerResults.map((c) => (
              <button
                key={c.id}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                onMouseDown={() => {
                  setCustomerSearch('')
                  setCustomerSearchOpen(false)
                  router.push(`/accounting/ar-invoices/customer/${c.id}`)
                }}
              >
                <User size={13} className="shrink-0 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
