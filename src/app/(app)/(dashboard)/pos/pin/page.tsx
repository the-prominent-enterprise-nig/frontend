'use client'

import { useState } from 'react'
import { KeyRound, ShieldCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { registerCashierPin, changeCashierPin } from '../_actions/pos-actions'

const PIN_RE = /^\d{4,6}$/

function PinInput({
  label,
  value,
  onChange,
  placeholder = '••••',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={6}
          className="input pr-9 font-mono tracking-widest"
          placeholder={placeholder}
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

export default function CashierPinPage() {
  // ── Set / Register PIN ─────────────────────────────────────────────────────
  const [regPin, setRegPin] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regSuccess, setRegSuccess] = useState(false)
  const [regError, setRegError] = useState('')

  async function handleRegister() {
    setRegError('')
    if (!PIN_RE.test(regPin)) {
      setRegError('PIN must be 4–6 digits.')
      return
    }
    if (regPin !== regConfirm) {
      setRegError('PINs do not match.')
      return
    }
    setRegLoading(true)
    const res = await registerCashierPin(regPin)
    setRegLoading(false)
    if (!res.success) {
      setRegError(res.error ?? 'Failed to set PIN')
      return
    }
    setRegSuccess(true)
    setRegPin('')
    setRegConfirm('')
    setTimeout(() => setRegSuccess(false), 3000)
  }

  // ── Change PIN ─────────────────────────────────────────────────────────────
  const [curPin, setCurPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [chgLoading, setChgLoading] = useState(false)
  const [chgSuccess, setChgSuccess] = useState(false)
  const [chgError, setChgError] = useState('')

  async function handleChange() {
    setChgError('')
    if (!PIN_RE.test(curPin)) {
      setChgError('Current PIN must be 4–6 digits.')
      return
    }
    if (!PIN_RE.test(newPin)) {
      setChgError('New PIN must be 4–6 digits.')
      return
    }
    if (newPin !== newConfirm) {
      setChgError('New PINs do not match.')
      return
    }
    if (curPin === newPin) {
      setChgError('New PIN must be different from current PIN.')
      return
    }
    setChgLoading(true)
    const res = await changeCashierPin(curPin, newPin)
    setChgLoading(false)
    if (!res.success) {
      setChgError(res.error ?? 'Failed to change PIN')
      return
    }
    setChgSuccess(true)
    setCurPin('')
    setNewPin('')
    setNewConfirm('')
    setTimeout(() => setChgSuccess(false), 3000)
  }

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashier PIN</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set or update your 4–6 digit numeric PIN used to identify yourself at the POS terminal.
          </p>
        </div>

        {/* Set PIN */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100">
              <KeyRound size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Set PIN</p>
              <p className="text-xs text-gray-500">Register or replace your cashier PIN.</p>
            </div>
          </div>

          <div className="space-y-3">
            <PinInput label="New PIN" value={regPin} onChange={setRegPin} />
            <PinInput label="Confirm PIN" value={regConfirm} onChange={setRegConfirm} />
          </div>

          {regError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{regError}</p>
          )}
          {regSuccess && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 size={14} /> PIN set successfully.
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={
              regLoading || !regPin || !regConfirm || regPin.length < 4 || regConfirm.length < 4
            }
            className="mt-4 w-full rounded-xl bg-purple-700 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-800 disabled:opacity-40"
          >
            {regLoading ? 'Setting PIN…' : 'Set PIN'}
          </button>
        </div>

        {/* Change PIN */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
              <ShieldCheck size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Change PIN</p>
              <p className="text-xs text-gray-500">Requires your current PIN.</p>
            </div>
          </div>

          <div className="space-y-3">
            <PinInput label="Current PIN" value={curPin} onChange={setCurPin} />
            <PinInput label="New PIN" value={newPin} onChange={setNewPin} />
            <PinInput label="Confirm New PIN" value={newConfirm} onChange={setNewConfirm} />
          </div>

          {chgError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{chgError}</p>
          )}
          {chgSuccess && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 size={14} /> PIN changed successfully.
            </div>
          )}

          <button
            onClick={handleChange}
            disabled={chgLoading || !curPin || !newPin || !newConfirm}
            className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-40"
          >
            {chgLoading ? 'Changing PIN…' : 'Change PIN'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          Your PIN is hashed and never stored in plain text.
        </p>
      </div>
    </div>
  )
}
