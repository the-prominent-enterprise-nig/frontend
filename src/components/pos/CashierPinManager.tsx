'use client'

import { useState } from 'react'
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ChevronRight,
} from 'lucide-react'
import {
  registerCashierPin,
  changeCashierPin,
} from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'

const PIN_RE = /^\d{4,6}$/

type Mode = 'set' | 'view' | 'change' | 'reset'

// ─── Shared primitives ────────────────────────────────────────────────────────

function PinInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={6}
          className="input pr-9 font-mono tracking-widest"
          placeholder="••••"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

function Banner({ type, message }: { type: 'error' | 'success'; message: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 size={14} className="shrink-0" />
      ) : (
        <AlertCircle size={14} className="shrink-0" />
      )}
      {message}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CashierPinManager({ initialHasPin }: { initialHasPin: boolean }) {
  const [mode, setMode] = useState<Mode>(initialHasPin ? 'view' : 'set')

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-6">
        {mode === 'set' && <SetPinCard onSuccess={() => setMode('view')} />}
        {mode === 'view' && <ViewPinCard onChangeClick={() => setMode('change')} />}
        {mode === 'change' && (
          <ChangePinCard
            onSuccess={() => setMode('view')}
            onCancel={() => setMode('view')}
            onForgot={() => setMode('reset')}
          />
        )}
        {mode === 'reset' && (
          <ResetPinCard onSuccess={() => setMode('view')} onBack={() => setMode('change')} />
        )}
      </div>

      {/* Right column: contextual hint */}
      <div className="hidden md:flex items-start">
        <PinHint mode={mode} />
      </div>
    </div>
  )
}

// ─── Mode: set ────────────────────────────────────────────────────────────────

function SetPinCard({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  async function handleSet() {
    setStatus(null)
    if (!PIN_RE.test(pin)) {
      setStatus({ type: 'error', msg: 'PIN must be 4–6 digits.' })
      return
    }
    if (pin !== confirm) {
      setStatus({ type: 'error', msg: 'PINs do not match.' })
      return
    }
    setLoading(true)
    const res = await registerCashierPin(pin)
    setLoading(false)
    if (!res.success) {
      setStatus({ type: 'error', msg: res.error ?? 'Failed to set PIN.' })
      return
    }
    onSuccess()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100">
          <KeyRound size={16} className="text-purple-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Set your PIN</p>
          <p className="text-xs text-gray-500">
            You don't have a PIN yet. Create one to enable POS approvals.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <PinInput label="New PIN" value={pin} onChange={setPin} />
        <PinInput label="Confirm PIN" value={confirm} onChange={setConfirm} />
      </div>

      {status && <Banner type={status.type} message={status.msg} />}

      <button
        onClick={handleSet}
        disabled={loading || !pin || !confirm}
        className="w-full rounded-xl bg-purple-700 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-800 disabled:opacity-40"
      >
        {loading ? 'Setting PIN…' : 'Set PIN'}
      </button>

      <p className="text-xs text-gray-400">Your PIN is hashed and never stored in plain text.</p>
    </div>
  )
}

// ─── Mode: view ───────────────────────────────────────────────────────────────

function ViewPinCard({ onChangeClick }: { onChangeClick: () => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100">
          <KeyRound size={16} className="text-purple-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">POS PIN</p>
          <p className="text-xs text-gray-500">Your PIN is active and ready for POS approvals.</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-0.5">PIN</p>
          <p className="font-mono text-lg tracking-[0.35em] text-gray-800 select-none">● ● ● ● ●</p>
        </div>
        <button
          onClick={onChangeClick}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Change
          <ChevronRight size={13} />
        </button>
      </div>

      <p className="text-xs text-gray-400">Your PIN is hashed and never stored in plain text.</p>
    </div>
  )
}

// ─── Mode: change ─────────────────────────────────────────────────────────────

function ChangePinCard({
  onSuccess,
  onCancel,
  onForgot,
}: {
  onSuccess: () => void
  onCancel: () => void
  onForgot: () => void
}) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  async function handleChange() {
    setStatus(null)
    if (!PIN_RE.test(cur)) {
      setStatus({ type: 'error', msg: 'Current PIN must be 4–6 digits.' })
      return
    }
    if (!PIN_RE.test(next)) {
      setStatus({ type: 'error', msg: 'New PIN must be 4–6 digits.' })
      return
    }
    if (next !== confirm) {
      setStatus({ type: 'error', msg: 'New PINs do not match.' })
      return
    }
    if (cur === next) {
      setStatus({ type: 'error', msg: 'New PIN must differ from current PIN.' })
      return
    }
    setLoading(true)
    const res = await changeCashierPin(cur, next)
    setLoading(false)
    if (!res.success) {
      setStatus({ type: 'error', msg: res.error ?? 'Failed to change PIN.' })
      return
    }
    onSuccess()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100">
          <KeyRound size={16} className="text-purple-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Change PIN</p>
          <p className="text-xs text-gray-500">Enter your current PIN to set a new one.</p>
        </div>
      </div>

      <div className="space-y-3">
        <PinInput label="Current PIN" value={cur} onChange={setCur} />
        <PinInput label="New PIN" value={next} onChange={setNext} />
        <PinInput label="Confirm New PIN" value={confirm} onChange={setConfirm} />
      </div>

      {status && <Banner type={status.type} message={status.msg} />}

      <div className="flex items-center justify-between gap-3">
        <button onClick={onForgot} className="text-xs text-purple-600 hover:underline">
          Forgot PIN?
        </button>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleChange}
            disabled={loading || !cur || !next || !confirm}
            className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-purple-800 disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Change PIN'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Mode: reset ──────────────────────────────────────────────────────────────

function ResetPinCard({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  async function handleReset() {
    setStatus(null)
    if (!PIN_RE.test(pin)) {
      setStatus({ type: 'error', msg: 'PIN must be 4–6 digits.' })
      return
    }
    if (pin !== confirm) {
      setStatus({ type: 'error', msg: 'PINs do not match.' })
      return
    }
    setLoading(true)
    const res = await registerCashierPin(pin)
    setLoading(false)
    if (!res.success) {
      setStatus({ type: 'error', msg: res.error ?? 'Failed to reset PIN.' })
      return
    }
    onSuccess()
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <RotateCcw size={16} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Reset PIN</p>
          <p className="text-xs text-gray-500">
            Your old PIN will be replaced — no old PIN required.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
        You are setting a new PIN without verifying your old one. Make sure you are the authorized
        user.
      </div>

      <div className="space-y-3">
        <PinInput label="New PIN" value={pin} onChange={setPin} />
        <PinInput label="Confirm New PIN" value={confirm} onChange={setConfirm} />
      </div>

      {status && <Banner type={status.type} message={status.msg} />}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleReset}
          disabled={loading || !pin || !confirm}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-40"
        >
          {loading ? 'Resetting…' : 'Reset PIN'}
        </button>
      </div>
    </div>
  )
}

// ─── Right-column hint ────────────────────────────────────────────────────────

const HINTS: Record<Mode, { title: string; body: string }> = {
  set: {
    title: 'Why do I need a PIN?',
    body: 'Your PIN is used to authorize manager-level actions at the POS — such as approving high-value discounts, voiding transactions, and handling receiptless returns. It is separate from your login password.',
  },
  view: {
    title: 'Your PIN is active',
    body: 'You can use your PIN at any POS terminal to approve overrides and sign off on transactions. Keep it confidential — do not share it with cashiers.',
  },
  change: {
    title: 'Changing your PIN',
    body: 'To change your PIN, you must first verify your current one. If you no longer remember your current PIN, use the "Forgot PIN?" link below the form.',
  },
  reset: {
    title: 'Resetting without your old PIN',
    body: 'Since you are already signed in, we can replace your PIN directly. This bypasses the current-PIN check. Your old PIN will be permanently replaced.',
  },
}

function PinHint({ mode }: { mode: Mode }) {
  const hint = HINTS[mode]
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 w-full">
      <p className="text-sm font-semibold text-gray-700 mb-2">{hint.title}</p>
      <p className="text-xs text-gray-500 leading-relaxed">{hint.body}</p>
    </div>
  )
}
