'use client'

import { useState, useEffect, useRef } from 'react'
import { Star, Search, User, AlertTriangle, CheckCircle2, Loader2, Save } from 'lucide-react'
import {
  getLoyaltyByCustomer,
  getLoyaltyHistory,
  getLoyaltyProgram,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  searchCustomers,
} from '../../_actions/pos-actions'
import type {
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyProgram,
  PosCustomer,
} from '@/src/schema/pos'
import { PosDateTime } from '../../_components/PosDate'

const eventTypeColor: Record<string, string> = {
  earned: 'bg-green-100 text-green-700',
  redeemed: 'bg-blue-100 text-blue-700',
  expired: 'bg-gray-100 text-gray-500',
  adjusted: 'bg-yellow-100 text-yellow-700',
}

function customerDisplayName(c: PosCustomer) {
  return c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Customer'
}

export default function LoyaltyClient({
  canManage,
  tenantId,
}: {
  canManage: boolean
  tenantId: string | null
}) {
  // ── Customer lookup ─────────────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<PosCustomer[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null)
  const [account, setAccount] = useState<LoyaltyAccount | null>(null)
  const [history, setHistory] = useState<LoyaltyTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Debounced customer search — same search-by-name-or-phone endpoint and
  // 300ms debounce already proven in pos/checkout/page.tsx, so a customer's
  // real (memorable) name/phone finds them instead of requiring their raw ID.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      setSearchOpen(false)
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearchingCustomers(true)
      const res = await searchCustomers(customerSearch.trim())
      setCustomerResults(res.data ?? [])
      setSearchOpen(true)
      setSearchingCustomers(false)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [customerSearch])

  async function handleSelectCustomer(customer: PosCustomer) {
    setSelectedCustomer(customer)
    setCustomerSearch('')
    setCustomerResults([])
    setSearchOpen(false)
    setAccount(null)
    setHistory([])
    setLoading(true)
    setError('')

    const accRes = await getLoyaltyByCustomer(customer.id)
    if (!accRes.success || !accRes.data) {
      setError(accRes.error ?? 'Loyalty account not found')
      setLoading(false)
      return
    }
    setAccount(accRes.data)

    const histRes = await getLoyaltyHistory(accRes.data.id)
    if (histRes.success && histRes.data) {
      setHistory(histRes.data)
    }
    setLoading(false)
  }

  // ── Loyalty program settings (Business Owner / Branch Manager only) ────────
  const [program, setProgram] = useState<LoyaltyProgram | null>(null)
  const [programLoading, setProgramLoading] = useState(canManage && !!tenantId)
  const [programSaving, setProgramSaving] = useState(false)
  const [programError, setProgramError] = useState('')
  const [programSuccess, setProgramSuccess] = useState(false)

  const [pointsPerUnit, setPointsPerUnit] = useState('0')
  const [pointsValue, setPointsValue] = useState('0')
  const [maxRedeemPct, setMaxRedeemPct] = useState('0')
  const [minimumRedeem, setMinimumRedeem] = useState('0')
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (!canManage || !tenantId) return
    getLoyaltyProgram(tenantId).then((res) => {
      setProgramLoading(false)
      // A failed call here just means no program has been configured for
      // this tenant yet — not a real error, so the form stays blank/zeroed
      // and Save creates one instead of updating.
      if (res.success && res.data) {
        const p = res.data
        setProgram(p)
        setPointsPerUnit(String(p.pointsPerUnit ?? 0))
        setPointsValue(String(p.pointsValue ?? 0))
        setMaxRedeemPct(String(p.maxRedeemPct ?? 0))
        setMinimumRedeem(String(p.minimumRedeem ?? 0))
        setIsActive(p.isActive ?? false)
      }
    })
  }, [canManage, tenantId])

  async function handleSaveProgram() {
    if (!tenantId) return
    setProgramSaving(true)
    setProgramError('')
    setProgramSuccess(false)

    const payload = {
      pointsPerUnit: pointsPerUnit === '' ? 0 : Math.max(0, Number(pointsPerUnit)),
      pointsValue: pointsValue === '' ? 0 : Math.max(0, Number(pointsValue)),
      maxRedeemPct: maxRedeemPct === '' ? 0 : Math.max(0, Math.min(100, Number(maxRedeemPct))),
      minimumRedeem: minimumRedeem === '' ? 0 : Math.max(0, Number(minimumRedeem)),
      isActive,
    }

    const res = program
      ? await updateLoyaltyProgram(program.id, payload)
      : await createLoyaltyProgram({ tenantId, ...payload })

    setProgramSaving(false)
    if (!res.success) {
      setProgramError(res.error ?? 'Failed to save loyalty program')
      return
    }
    if (res.data) {
      const saved = res.data
      setProgram(saved)
      setPointsPerUnit(String(saved.pointsPerUnit ?? 0))
      setPointsValue(String(saved.pointsValue ?? 0))
      setMaxRedeemPct(String(saved.maxRedeemPct ?? 0))
      setMinimumRedeem(String(saved.minimumRedeem ?? 0))
      setIsActive(saved.isActive ?? false)
    }
    setProgramSuccess(true)
    setTimeout(() => setProgramSuccess(false), 3000)
  }

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Look Up Customer Balance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Look up customer loyalty accounts and point history.
          </p>
        </div>

        {/* Loyalty Program settings — Business Owner / Branch Manager only */}
        {canManage && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Star size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Loyalty Program</h2>
                <p className="text-sm text-gray-500">Points earning and redemption rules.</p>
              </div>
            </div>

            {programLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-purple-500" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="loyalty-points-per-unit"
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      Points per Unit
                    </label>
                    <p className="mb-2 text-xs text-gray-500">
                      How many points a customer earns for every ₱1 spent.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        id="loyalty-points-per-unit"
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        value={pointsPerUnit === '0' ? '' : pointsPerUnit}
                        onChange={(e) => setPointsPerUnit(e.target.value)}
                      />
                      <span className="text-sm text-gray-500">points per ₱1</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label
                      htmlFor="loyalty-points-value"
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      Points Value
                    </label>
                    <p className="mb-2 text-xs text-gray-500">
                      How much 1 point is worth when a customer redeems it.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">₱</span>
                      <input
                        id="loyalty-points-value"
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        value={pointsValue === '0' ? '' : pointsValue}
                        onChange={(e) => setPointsValue(e.target.value)}
                      />
                      <span className="text-sm text-gray-500">per point</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label
                      htmlFor="loyalty-max-redeem-pct"
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      Max Redeem %
                    </label>
                    <p className="mb-2 text-xs text-gray-500">
                      The maximum percentage of a sale a customer can pay for using loyalty points.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        id="loyalty-max-redeem-pct"
                        type="number"
                        min={0}
                        max={100}
                        placeholder="0"
                        className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        value={maxRedeemPct === '0' ? '' : maxRedeemPct}
                        onChange={(e) => setMaxRedeemPct(e.target.value)}
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label
                      htmlFor="loyalty-minimum-redeem"
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      Minimum Redeem
                    </label>
                    <p className="mb-2 text-xs text-gray-500">
                      The minimum number of points a customer must have before they can redeem any.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        id="loyalty-minimum-redeem"
                        type="number"
                        min={0}
                        placeholder="0"
                        className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        value={minimumRedeem === '0' ? '' : minimumRedeem}
                        onChange={(e) => setMinimumRedeem(e.target.value)}
                      />
                      <span className="text-sm text-gray-500">points</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Active</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Whether the loyalty program is enabled at checkout.
                        </p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={isActive}
                        aria-label="Active"
                        onClick={() => setIsActive((v) => !v)}
                        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${isActive ? 'bg-purple-600' : 'bg-gray-200'}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {programError && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                    <AlertTriangle size={14} />
                    {programError}
                  </div>
                )}
                {programSuccess && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                    <CheckCircle2 size={14} />
                    Loyalty program saved.
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveProgram}
                    disabled={programSaving}
                    className="flex items-center gap-2 rounded-xl bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
                  >
                    {programSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {programSaving ? 'Saving…' : program ? 'Save Changes' : 'Create'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Search */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-700">Customer Lookup</p>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search by name, phone, or customer code…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onFocus={() => customerResults.length > 0 && setSearchOpen(true)}
            />
            {searchingCustomers && (
              <Loader2
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
              />
            )}
          </div>

          {searchOpen && (
            <div
              role="region"
              aria-label="Customer search results"
              className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
            >
              {customerResults.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">No customers found</p>
              ) : (
                customerResults.map((c) => (
                  <button
                    key={c.id}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50"
                    onMouseDown={() => handleSelectCustomer(c)}
                  >
                    <User size={13} className="shrink-0 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{customerDisplayName(c)}</p>
                      {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Account Summary */}
        {account && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-800">
                  {selectedCustomer ? customerDisplayName(selectedCustomer) : ''}
                </p>
              </div>
              {account.tier && (
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                  {account.tier}
                </span>
              )}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4">
              <PointStat
                label="Current Points"
                value={account.currentPoints.toLocaleString()}
                accent
              />
              <PointStat label="Lifetime Earned" value={account.lifetimeEarned.toLocaleString()} />
              <PointStat
                label="Lifetime Redeemed"
                value={account.lifetimeRedeemed.toLocaleString()}
              />
            </div>
          </div>
        )}

        {/* History */}
        {account && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="text-sm font-semibold text-gray-700">Point History</p>
            </div>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                <Star size={36} />
                <p className="text-sm">No history yet.</p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Event
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Points
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Balance After
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${eventTypeColor[h.eventType]}`}
                        >
                          {h.eventType}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${h.pointsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {h.pointsChange >= 0 ? '+' : ''}
                        {h.pointsChange}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {h.balanceAfter.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        <PosDateTime iso={h.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Empty state when no search yet */}
        {!account && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 py-16 text-gray-400">
            <Star size={40} />
            <p className="text-sm">Search for a customer to view their loyalty account.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PointStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-purple-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}
