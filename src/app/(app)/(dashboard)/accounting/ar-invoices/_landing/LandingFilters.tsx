'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useUrlFilters } from '@/src/components/ssr/UrlFilters'
import { CustomerSearchBox } from '../_components/CustomerSearchBox'

const DEBOUNCE_MS = 400

/**
 * The landing's filter card. Searching by invoice / transaction number writes
 * `?q=` to the URL ~400 ms after typing stops (no Apply click) and the server
 * re-renders the rollup; picking a customer opens that customer's page.
 */
export function LandingFilters({ q }: { q?: string }): React.JSX.Element {
  const { setParams } = useUrlFilters()
  const [value, setValue] = useState(q ?? '')
  // The last value this box wrote to the URL: when the URL catches up to it,
  // do not overwrite what the user has typed since.
  const sent = useRef(q ?? '')

  useEffect(() => {
    if ((q ?? '') !== sent.current) {
      sent.current = q ?? ''
      setValue(q ?? '')
    }
  }, [q])

  useEffect(() => {
    if (value.trim() === sent.current.trim()) return
    const timer = setTimeout(() => {
      sent.current = value
      setParams({ q: value.trim() })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value, setParams])

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <CustomerSearchBox />
      <div className="min-w-64 flex-1">
        <label className="mb-1 block text-xs font-semibold text-gray-600">
          Invoice # or Transaction #
        </label>
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-purple-500 focus:outline-none"
            placeholder="Search…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      </div>
      {q && (
        <button
          onClick={() => {
            sent.current = ''
            setValue('')
            setParams({ q: undefined })
          }}
          className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          Clear
        </button>
      )}
    </div>
  )
}
