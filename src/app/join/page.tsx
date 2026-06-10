'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Users, Clock, CheckCircle2, UtensilsCrossed, AlertCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface VenueInfo {
  waitingCount: number
  quotedWaitMins: number | null
}

export default function JoinWaitlistPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-amber-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
        </div>
      }
    >
      <JoinWaitlistContent />
    </Suspense>
  )
}

function JoinWaitlistContent() {
  const params = useSearchParams()
  const tenantId = params.get('t') ?? ''

  const [info, setInfo] = useState<VenueInfo | null>(null)
  const [infoError, setInfoError] = useState(false)

  const [name, setName] = useState('')
  const [size, setSize] = useState('2')
  const [phone, setPhone] = useState('')
  const [pref, setPref] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    fetch(`${API}/restaurant/waitlist/qr-info?tenantId=${tenantId}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfoError(true))
  }, [tenantId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    if (!tenantId) {
      setError('Invalid QR code — missing venue ID')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API}/restaurant/waitlist/qr-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          name: name.trim(),
          size: Math.max(1, parseInt(size, 10) || 1),
          phone: phone.trim() || undefined,
          seatingPref: pref.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message ?? 'Failed to join waitlist. Please try again.')
        setSubmitting(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Could not reach the venue. Please try again.')
      setSubmitting(false)
    }
  }

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-gray-600">Invalid QR code. Please scan again.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">You're on the list!</h1>
          <p className="text-gray-500 text-sm mb-4">
            We'll seat you as soon as a table is ready. You can close this page.
          </p>
          {info?.waitingCount != null && info.waitingCount > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              {info.waitingCount} {info.waitingCount === 1 ? 'party' : 'parties'} ahead of you
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 text-center">
          <UtensilsCrossed className="w-8 h-8 text-amber-600 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-900">Join the Waitlist</h1>
          {infoError ? null : !info ? (
            <div className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-center gap-3 text-xs text-gray-500">
              {info.waitingCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {info.waitingCount} waiting
                </span>
              )}
              {info.quotedWaitMins != null && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> ~{info.quotedWaitMins} min wait
                </span>
              )}
              {info.waitingCount === 0 && (
                <span className="text-emerald-600 font-medium">Tables available now</span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Your name *</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="e.g. Smith Party"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Party size</span>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSize((s) => String(Math.max(1, parseInt(s, 10) - 1)))}
                className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 text-lg font-bold hover:bg-gray-50 flex items-center justify-center"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold text-gray-900">{size}</span>
              <button
                type="button"
                onClick={() => setSize((s) => String(parseInt(s, 10) + 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 text-lg font-bold hover:bg-gray-50 flex items-center justify-center"
              >
                +
              </button>
              <span className="text-xs text-gray-400 ml-1">
                {parseInt(size, 10) === 1 ? 'person' : 'people'}
              </span>
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="09XX XXX XXXX"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">
              Seating preference <span className="text-gray-400 font-normal">(optional)</span>
            </span>
            <input
              value={pref}
              onChange={(e) => setPref(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="Window, booth, outdoor…"
            />
          </label>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full py-3 text-sm font-bold bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Joining…
              </>
            ) : (
              'Join Waitlist'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
