'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BookMarked,
  Plus,
  Loader2,
  RefreshCw,
  ChevronDown,
  X,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  RestaurantBookings,
  type Booking,
  type BookingStatus,
  type CreateBookingInput,
} from '@/src/libs/data/RestaurantData'
import { CapabilityGuard } from '../_components/CapabilityGuard'

const STATUS_STYLES: Record<BookingStatus, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-100', text: 'text-blue-700' },
  SEATED: { label: 'Seated', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  COMPLETED: { label: 'Completed', bg: 'bg-gray-100', text: 'text-gray-600' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700' },
  NO_SHOW: { label: 'No Show', bg: 'bg-orange-100', text: 'text-orange-700' },
}

const TODAY = new Date().toISOString().slice(0, 10)

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function BookingsPage() {
  const [date, setDate] = useState(TODAY)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<CreateBookingInput>({
    date: today(),
    time: '',
    partySize: 2,
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    notes: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [slotsPartySize, setSlotsPartySize] = useState(2)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await RestaurantBookings.list(date)
    if (res.success && res.data) setBookings(res.data)
    else setError(res.message ?? 'Failed to load bookings')
    setLoading(false)
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true)
    const res = await RestaurantBookings.availableSlots(form.date, slotsPartySize)
    if (res.success && res.data) setSlots(res.data)
    setLoadingSlots(false)
  }, [form.date, slotsPartySize])

  useEffect(() => {
    if (showForm) loadSlots()
  }, [showForm, loadSlots])

  const submit = async () => {
    if (!form.guestName.trim()) {
      setFormError('Guest name is required')
      return
    }
    if (!form.time) {
      setFormError('Please select a time slot')
      return
    }
    setFormError('')
    setSubmitting(true)
    const res = await RestaurantBookings.create(form)
    if (res.success) {
      setShowForm(false)
      setForm({
        date: today(),
        time: '',
        partySize: 2,
        guestName: '',
        guestPhone: '',
        guestEmail: '',
        notes: '',
      })
      load()
    } else {
      setFormError(res.message ?? 'Failed to create booking')
    }
    setSubmitting(false)
  }

  const updateStatus = async (id: string, status: BookingStatus) => {
    const res = await RestaurantBookings.update(id, { status })
    if (res.success && res.data) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this booking?')) return
    await RestaurantBookings.remove(id)
    setBookings((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <CapabilityGuard capability="reservations">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-gray-600" />
            <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
            >
              <Plus className="h-4 w-4" /> New Booking
            </button>
          </div>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm font-medium text-gray-600">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <span className="text-sm text-gray-400">
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Booking list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading bookings...
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <BookMarked className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No bookings for this date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const s = STATUS_STYLES[b.status]
              return (
                <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{b.guestName}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {b.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {b.partySize} guests
                        </span>
                        {b.guestPhone && <span>{b.guestPhone}</span>}
                      </div>
                      {b.notes && <p className="mt-1 text-xs text-gray-400 italic">{b.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {b.status === 'PENDING' && (
                        <button
                          onClick={() => updateStatus(b.id, 'CONFIRMED')}
                          className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                        </button>
                      )}
                      {b.status === 'CONFIRMED' && (
                        <button
                          onClick={() => updateStatus(b.id, 'SEATED')}
                          className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                        >
                          Seat
                        </button>
                      )}
                      {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                        <>
                          <button
                            onClick={() => updateStatus(b.id, 'NO_SHOW')}
                            className="rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition"
                          >
                            No Show
                          </button>
                          <button
                            onClick={() => updateStatus(b.id, 'CANCELLED')}
                            className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition flex items-center gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </>
                      )}
                      {(b.status === 'CANCELLED' ||
                        b.status === 'COMPLETED' ||
                        b.status === 'NO_SHOW') && (
                        <button
                          onClick={() => remove(b.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* New Booking Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 mx-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">New Booking</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1.5 hover:bg-gray-100 transition"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {formError && (
                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Guest Name *
                  </label>
                  <input
                    value={form.guestName}
                    onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Full name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                    <input
                      value={form.guestPhone}
                      onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="+63..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Party Size
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.partySize}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setForm({ ...form, partySize: v })
                        setSlotsPartySize(v)
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value, time: '' })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Time *{' '}
                      {loadingSlots && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
                    </label>
                    {slots.length > 0 ? (
                      <div className="relative">
                        <select
                          value={form.time}
                          onChange={(e) => setForm({ ...form, time: e.target.value })}
                          className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        >
                          <option value="">Pick a slot</option>
                          {slots.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      </div>
                    ) : (
                      <input
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Allergies, special requests..."
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Booking
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CapabilityGuard>
  )
}
