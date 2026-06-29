'use client'

import { useState } from 'react'
import {
  useGiftCards,
  useIssueGiftCard,
  useVoidGiftCard,
  useGiftCardHistory,
} from '../_hooks/usePos'
import { RefreshCw, CreditCard, Plus, X, ChevronDown, History } from 'lucide-react'
import type { GiftCard, IssueGiftCardInput, GiftCardHistoryEntry } from '@/src/schema/pos'

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  depleted: 'bg-gray-100 text-gray-500',
  expired: 'bg-orange-100 text-orange-700',
  voided: 'bg-red-100 text-red-700',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

function formatDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function GiftCardsPage() {
  const { data, isLoading, isFetching, refetch } = useGiftCards()
  const issueMutation = useIssueGiftCard()
  const voidMutation = useVoidGiftCard()

  const [showIssue, setShowIssue] = useState(false)
  const [voidTarget, setVoidTarget] = useState<GiftCard | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [historyTarget, setHistoryTarget] = useState<GiftCard | null>(null)
  const [error, setError] = useState('')

  const cards: GiftCard[] = data?.data ?? []

  async function handleIssue(form: IssueGiftCardInput) {
    setError('')
    const res = await issueMutation.mutateAsync(form)
    if (!res.success) {
      setError(res.error ?? 'Failed to issue gift card')
      return
    }
    setShowIssue(false)
  }

  async function handleVoid() {
    if (!voidTarget) return
    setError('')
    const res = await voidMutation.mutateAsync({
      id: voidTarget.id,
      reason: voidReason || undefined,
    })
    if (!res.success) {
      setError(res.error ?? 'Failed to void gift card')
      return
    }
    setVoidTarget(null)
    setVoidReason('')
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gift Cards</h1>
            <p className="mt-1 text-sm text-gray-500">Issue and manage gift cards.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => {
                setError('')
                setShowIssue(true)
              }}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
            >
              <Plus size={14} />
              Issue Gift Card
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-4">
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <CreditCard size={40} />
              <p className="text-sm">No gift cards yet.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Card Number
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Initial Value
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Balance
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Expires
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cards.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono font-medium text-gray-800">
                      {c.cardNumber}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {formatCurrency(c.initialValue)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(c.currentBalance)}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{formatDate(c.expiresAt)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[c.status]}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            setHistoryTarget(c)
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                        >
                          <History size={12} />
                          History
                        </button>
                        {c.status === 'active' && (
                          <button
                            onClick={() => {
                              setError('')
                              setVoidReason('')
                              setVoidTarget(c)
                            }}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showIssue && (
        <IssueModal
          error={error}
          isLoading={issueMutation.isPending}
          onClose={() => {
            setShowIssue(false)
            setError('')
          }}
          onSubmit={handleIssue}
        />
      )}

      {voidTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => {
              setVoidTarget(null)
              setVoidReason('')
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-2 text-lg font-bold text-gray-900">Void Gift Card?</h2>
              <p className="mb-4 text-sm text-gray-600">
                Void <span className="font-mono">{voidTarget.cardNumber}</span>? Balance{' '}
                {formatCurrency(voidTarget.currentBalance)} will be lost.
              </p>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Reason (optional)
                </label>
                <input
                  className="input w-full"
                  placeholder="e.g. lost card, customer request"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
              {error && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setVoidTarget(null)
                    setVoidReason('')
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVoid}
                  disabled={voidMutation.isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {voidMutation.isPending ? 'Voiding…' : 'Void'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {historyTarget && (
        <GiftCardHistoryModal card={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  )
}

function IssueModal({
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: IssueGiftCardInput) => void
}) {
  const [form, setForm] = useState({
    cardNumber: '',
    initialValue: 500,
    currency: 'PHP',
    issuedToCustomerId: '',
    expiresAt: '',
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          <h2 className="mb-4 text-lg font-bold text-gray-900">Issue Gift Card</h2>
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="space-y-4">
            <Field label="Card Number">
              <input
                className="input"
                placeholder="GC-2026-0001"
                value={form.cardNumber}
                onChange={(e) => setForm((p) => ({ ...p, cardNumber: e.target.value }))}
              />
            </Field>
            <Field label="Initial Value">
              <div className="flex gap-2">
                <div className="relative w-24">
                  <select
                    className="select px-2 pr-6"
                    value={form.currency}
                    onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                  >
                    <option value="PHP">PHP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <ChevronDown
                    size={12}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
                <input
                  className="input flex-1"
                  type="number"
                  min={1}
                  step={0.01}
                  value={form.initialValue === 0 ? '' : form.initialValue}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, initialValue: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
            </Field>
            <Field label="Customer ID (optional)">
              <input
                className="input"
                placeholder="Customer UUID"
                value={form.issuedToCustomerId}
                onChange={(e) => setForm((p) => ({ ...p, issuedToCustomerId: e.target.value }))}
              />
            </Field>
            <Field label="Expires At (optional)">
              <input
                className="input"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() =>
                onSubmit({
                  cardNumber: form.cardNumber,
                  initialValue: form.initialValue,
                  currency: form.currency,
                  issuedToCustomerId: form.issuedToCustomerId || undefined,
                  expiresAt: form.expiresAt || undefined,
                })
              }
              disabled={isLoading || !form.cardNumber.trim() || form.initialValue <= 0}
              className="btn-primary"
            >
              {isLoading ? 'Issuing…' : 'Issue Card'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}

const historyTypeColor: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-700',
  used: 'bg-green-100 text-green-700',
  voided: 'bg-red-100 text-red-700',
  adjusted: 'bg-yellow-100 text-yellow-700',
}

function GiftCardHistoryModal({ card, onClose }: { card: GiftCard; onClose: () => void }) {
  const { data, isLoading } = useGiftCardHistory(card.id)
  const entries: GiftCardHistoryEntry[] = data?.data ?? []

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          <h2 className="mb-1 text-lg font-bold text-gray-900">Gift Card History</h2>
          <p className="mb-4 font-mono text-sm text-gray-500">{card.cardNumber}</p>
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-3">
                  <div className="h-4 w-16 rounded bg-gray-200" />
                  <div className="h-4 flex-1 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No history available.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                      Type
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">
                      Balance After
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${historyTypeColor[e.type] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {e.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {formatCurrency(e.amount)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {formatCurrency(e.balanceAfter)}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{formatDate(e.occurredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
