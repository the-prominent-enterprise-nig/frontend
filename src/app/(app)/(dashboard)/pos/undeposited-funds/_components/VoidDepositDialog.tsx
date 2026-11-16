'use client'

import { useState } from 'react'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { voidPosDeposit, type PosDeposit } from '../_actions/pos-deposits'

/** A posted deposit accounting may still void: not yet matched to a bank
 * statement, and no turnover in it already taken in by the receiving branch.
 * Mirrors the backend's assertVoidable. */
export function voidable(deposit: PosDeposit): boolean {
  return (
    deposit.status === 'cleared' &&
    !deposit.reconciledAt &&
    !(deposit.lines ?? []).some((l) => l.turnoverStatus === 'acknowledged')
  )
}

/** `₱6,000.00 · slip 970` — which deposit is being voided. */
function describe(deposit: PosDeposit): string {
  const refs = (deposit.lines ?? []).map((l) => l.reference).filter(Boolean)
  const slips = refs.length ? ` · slip ${refs.join(', ')}` : ''
  return `${fmtMoney(Number(deposit.amount))}${slips}`
}

/**
 * Asks why, then voids a posted deposit the bank never received — a slip
 * recorded twice. Its entries are reversed on their own date and what it
 * banked of each session goes back to To deposit.
 */
export function VoidDepositDialog({
  deposit,
  onCancel,
  onVoided,
}: {
  deposit: PosDeposit
  onCancel: () => void
  onVoided: () => void
}): React.JSX.Element {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await voidPosDeposit(deposit.id, reason.trim())
    setBusy(false)
    if (!res.success) {
      setError(res.error || res.message || 'Failed to void the deposit')
      return
    }
    showToast({ title: 'Deposit voided', description: describe(deposit), status: 'success' })
    onVoided()
  }

  return (
    <ConfirmDialog
      open
      title="Void this deposit?"
      message={
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-medium text-gray-900">{describe(deposit)}</span> is reversed in
            the books, and what it banked goes back to To deposit. Use this only when the bank never
            received it — a slip recorded twice. To fix a wrong amount, bank or account, edit the
            deposit instead.
          </p>
          <label className="block">
            <span className="font-medium text-gray-700">Reason *</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="e.g. Recorded twice — the bank shows one ₱6,000 credit"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      }
      confirmLabel="Void deposit"
      destructive
      loading={busy}
      confirmDisabled={!reason.trim()}
      onCancel={onCancel}
      onConfirm={run}
    />
  )
}
