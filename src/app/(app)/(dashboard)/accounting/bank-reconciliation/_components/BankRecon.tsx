'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, CheckCircle, X, FileEdit, ArrowRightLeft, Landmark } from 'lucide-react'
import {
  BankAccounts,
  BankAdjusting,
  ClearingSettlements,
  UnidentifiedBankCredits,
  type BankAccount,
  type BankReconciliation,
  type ClearingSettlement,
  type ClearingSettlementType,
  type UnidentifiedBankCredit,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'

const CLEARING_TYPE_LABELS: Record<ClearingSettlementType, string> = {
  card: 'Card',
  ewallet: 'E-Wallet',
  bank_transfer: 'Bank Transfer',
  tpf: 'TPF Partner',
}

// Scenario 42 Part 3 — the real discrepancy, from whichever lines are
// checked right now — not the naive statementBalance - systemBalance diff,
// which only happens to be correct while nothing's checked yet.
function reconDiscrepancy(r: BankReconciliation): number {
  const lines = r.lines ?? []
  const checkedDeposits = lines
    .filter((l) => l.checked && l.direction === 'DEPOSIT')
    .reduce((s, l) => s + l.amount, 0)
  const checkedWithdrawals = lines
    .filter((l) => l.checked && l.direction === 'WITHDRAWAL')
    .reduce((s, l) => s + l.amount, 0)
  const adjustedBalance = r.statementBalance + checkedDeposits - checkedWithdrawals
  return adjustedBalance - r.systemBalance
}

export default function BankRecon() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [recs, setRecs] = useState<BankReconciliation[]>([])
  const [settlements, setSettlements] = useState<ClearingSettlement[]>([])
  const [credits, setCredits] = useState<UnidentifiedBankCredit[]>([])
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(false)
  const [settling, setSettling] = useState(false)
  const [recordingCredit, setRecordingCredit] = useState(false)
  const [reclassifying, setReclassifying] = useState<UnidentifiedBankCredit | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [a, r, s, c] = await Promise.all([
      BankAccounts.list(),
      BankAccounts.listReconciliations(),
      ClearingSettlements.list(),
      UnidentifiedBankCredits.list(),
    ])
    setAccounts(a.data ?? [])
    setRecs(r.data ?? [])
    setSettlements(s.data ?? [])
    setCredits(c.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const complete = async (id: string) => {
    const res = await BankAccounts.completeReconciliation(id)
    if (!res.success) {
      alert(res.message || res.error || 'Failed to complete reconciliation')
      return
    }
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Bank Reconciliation</h2>
          <p className="text-sm text-gray-500">Compare bank statements to system records.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setAdjusting(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg"
          >
            <FileEdit className="w-4 h-4" /> Adjusting Entry
          </button>
          <button
            onClick={() => setRecordingCredit(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg"
          >
            <Plus className="w-4 h-4" /> Unidentified Credit
          </button>
          <button
            onClick={() => setSettling(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg"
          >
            <ArrowRightLeft className="w-4 h-4" /> Settle Clearing Account
          </button>
          <Link
            href="/accounting/bank-reconciliation/transfer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg"
          >
            <Landmark className="w-4 h-4" /> Fund Transfer
          </Link>
          <Link
            href="/accounting/bank-reconciliation/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Reconciliation
          </Link>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Statement Date</th>
              <th className="px-3 py-2 text-right">Statement Balance</th>
              <th className="px-3 py-2 text-right">System Balance</th>
              <th className="px-3 py-2 text-right">Difference</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : recs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  No reconciliations.
                </td>
              </tr>
            ) : (
              recs.map((r) => {
                const discrepancy = reconDiscrepancy(r)
                const isZero = Math.abs(discrepancy) < 0.01
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/accounting/bank-reconciliation/${r.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">{r.bankAccount?.name}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(r.statementDate)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.statementBalance)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.systemBalance)}</td>
                    <td
                      className={`px-3 py-2 text-right ${isZero ? 'text-emerald-700' : 'text-amber-700'}`}
                    >
                      {fmtMoney(discrepancy)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.reconciled ? (
                        <span className="text-emerald-700">Reconciled</span>
                      ) : (
                        <span className="text-amber-700">Pending</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!r.reconciled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            complete(r.id)
                          }}
                          disabled={!isZero}
                          title={
                            isZero
                              ? 'Mark reconciled'
                              : `Cannot complete — discrepancy of ${fmtMoney(discrepancy)}. Open the worksheet to check off cleared items.`
                          }
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {(loading || settlements.length > 0) && (
        <>
          <div className="mt-6 flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold">Clearing Settlements</h3>
              <p className="text-xs text-gray-500">
                Card/e-wallet/bank-transfer batches and TPF partner receivables settling into the
                bank.
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Bank Account</th>
                  <th className="px-3 py-2 text-left">Settled</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Fee</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  settlements.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2">
                        {CLEARING_TYPE_LABELS[s.clearingType]}
                        {s.tpfProvider && (
                          <span className="text-gray-500"> — {s.tpfProvider.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{s.bankAccount?.name}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(s.settledAt)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(s.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        {s.feeAmount > 0 ? fmtMoney(s.feeAmount) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">{s.referenceNo || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(loading || credits.length > 0) && (
        <>
          <div className="mt-6 flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold">Unidentified Bank Credits</h3>
              <p className="text-xs text-gray-500">
                Bank credits with no matching sale or settlement yet — reclassify once identified.
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Bank Account</th>
                  <th className="px-3 py-2 text-left">Credit Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Bank Ref</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  credits.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2">{c.bankAccount?.name}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(c.creditDate)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(c.amount)}</td>
                      <td className="px-3 py-2 text-xs">{c.bankRef || '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.status === 'unmatched' ? (
                          <span className="text-amber-700">Unmatched</span>
                        ) : (
                          <span className="text-emerald-700" title={c.reclassifiedNote ?? ''}>
                            Reclassified
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {c.status === 'unmatched' && (
                          <button
                            onClick={() => setReclassifying(c)}
                            className="px-2 py-1 text-xs text-purple-700 hover:bg-purple-50 border border-purple-200 rounded"
                          >
                            Reclassify
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {settling && (
        <SettlementForm
          accounts={accounts}
          onClose={() => setSettling(false)}
          onSaved={() => {
            setSettling(false)
            load()
          }}
        />
      )}
      {recordingCredit && (
        <UnidentifiedCreditForm
          accounts={accounts}
          onClose={() => setRecordingCredit(false)}
          onSaved={() => {
            setRecordingCredit(false)
            load()
          }}
        />
      )}
      {reclassifying && (
        <ReclassifyForm
          credit={reclassifying}
          onClose={() => setReclassifying(null)}
          onSaved={() => {
            setReclassifying(null)
            load()
          }}
        />
      )}
      {adjusting && (
        <AdjustingForm
          accounts={accounts}
          onClose={() => setAdjusting(false)}
          onSaved={() => setAdjusting(false)}
        />
      )}
    </div>
  )
}

function AdjustingForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: BankAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    bankAccountId: '',
    type: 'BANK_CHARGE' as 'BANK_CHARGE' | 'INTEREST_INCOME',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await BankAdjusting.create({ ...form, amount: Number(form.amount) })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed — check Account Mapping settings')
      return
    }
    alert('Adjusting journal entry posted to GL.')
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Adjusting Entry</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            Records bank charges or interest income. Auto-posts to the General Ledger.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Bank Account *</span>
            <select
              required
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Type *</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="BANK_CHARGE">Bank Charge</option>
              <option value="INTEREST_INCOME">Interest Income</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Amount *</span>
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Date *</span>
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post to GL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SettlementForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: BankAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    bankAccountId: '',
    clearingType: 'card' as ClearingSettlementType,
    tpfProviderId: '',
    amount: '',
    feeAmount: '',
    referenceNo: '',
    settledAt: new Date().toISOString().slice(0, 10),
  })
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (form.clearingType === 'tpf' && providers.length === 0) {
      ClearingSettlements.activeTpfProviders().then((r) => setProviders(r.data ?? []))
    }
  }, [form.clearingType, providers.length])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await ClearingSettlements.record({
      bankAccountId: form.bankAccountId,
      clearingType: form.clearingType,
      tpfProviderId: form.clearingType === 'tpf' ? form.tpfProviderId : undefined,
      amount: Number(form.amount),
      feeAmount: form.feeAmount ? Number(form.feeAmount) : undefined,
      referenceNo: form.referenceNo || undefined,
      settledAt: form.settledAt,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed — check Account Mapping settings')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Settle Clearing Account</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            Confirms a card/e-wallet/bank-transfer batch — or a TPF partner payout — actually landed
            in the bank. Auto-posts to the General Ledger.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Bank Account *</span>
            <select
              required
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Clearing Type *</span>
            <select
              value={form.clearingType}
              onChange={(e) =>
                setForm({ ...form, clearingType: e.target.value as ClearingSettlementType })
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              {Object.entries(CLEARING_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {form.clearingType === 'tpf' && (
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">TPF Partner *</span>
              <select
                required
                value={form.tpfProviderId}
                onChange={(e) => setForm({ ...form, tpfProviderId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">— Select —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Amount *</span>
              <input
                required
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Fee (optional)</span>
              <input
                type="number"
                step="0.01"
                value={form.feeAmount}
                onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Settled Date *</span>
            <input
              required
              type="date"
              value={form.settledAt}
              onChange={(e) => setForm({ ...form, settledAt: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Reference / Batch No.
            </span>
            <input
              value={form.referenceNo}
              onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post to GL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UnidentifiedCreditForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: BankAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    bankAccountId: '',
    amount: '',
    creditDate: new Date().toISOString().slice(0, 10),
    bankRef: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await UnidentifiedBankCredits.record({
      bankAccountId: form.bankAccountId,
      amount: Number(form.amount),
      creditDate: form.creditDate,
      bankRef: form.bankRef || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed — check Account Mapping settings')
      return
    }
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Record Unidentified Bank Credit</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            An unexplained credit on the bank statement, no matching sale or settlement yet.
            Reclassify it once identified.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Bank Account *</span>
            <select
              required
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Amount *</span>
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Credit Date *</span>
            <input
              required
              type="date"
              value={form.creditDate}
              onChange={(e) => setForm({ ...form, creditDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Bank Statement Reference
            </span>
            <input
              value={form.bankRef}
              onChange={(e) => setForm({ ...form, bankRef: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post to GL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReclassifyForm({
  credit,
  onClose,
  onSaved,
}: {
  credit: UnidentifiedBankCredit
  onClose: () => void
  onSaved: () => void
}) {
  const [targetType, setTargetType] = useState<ClearingSettlementType>('card')
  const [tpfProviderId, setTpfProviderId] = useState('')
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (targetType === 'tpf' && providers.length === 0) {
      ClearingSettlements.activeTpfProviders().then((r) => setProviders(r.data ?? []))
    }
  }, [targetType, providers.length])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await UnidentifiedBankCredits.reclassify(credit.id, {
      targetType,
      tpfProviderId: targetType === 'tpf' ? tpfProviderId : undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to reclassify')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Reclassify Credit</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            {fmtMoney(credit.amount)} unidentified credit at {credit.bankAccount?.name} on{' '}
            {fmtDate(credit.creditDate)}. Now identified as:
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Identified As *</span>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as ClearingSettlementType)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              {Object.entries(CLEARING_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {targetType === 'tpf' && (
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">TPF Partner *</span>
              <select
                required
                value={tpfProviderId}
                onChange={(e) => setTpfProviderId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">— Select —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Reclassify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
