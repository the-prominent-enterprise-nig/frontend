'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Landmark, Wallet, BookUser, X } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import type { BankAccountOption } from '@/src/libs/data/AccountingV2Data'
import {
  setRoleScopes,
  type RoleScope,
  type RoleScopeKind,
} from '@/src/app/(app)/(dashboard)/settings/_actions/role-scopes'

export type ControlAccount = { id: string; number: string; name: string }

type Target = { id: string; label: string }

// Business Owner holds everything, with no exceptions (role hierarchy), so it
// never carries limits.
const FOUNDER_ROLE_NAME = 'Business Owner'

const CARD =
  'overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.06)]'

function bankLabel(a: BankAccountOption): string {
  return a.name === a.bankName ? a.name : `${a.name} — ${a.bankName}`
}

/** The ids of one kind of limit, in the order they were added. */
function idsOf(scopes: RoleScope[], kind: RoleScopeKind): string[] {
  return scopes.filter((s) => s.kind === kind && s.targetId).map((s) => s.targetId!)
}

function TargetList({
  title,
  hint,
  icon: Icon,
  empty,
  selected,
  options,
  onChange,
  disabled,
  children,
}: {
  title: string
  hint: string
  icon: typeof Landmark
  empty: string
  selected: string[]
  options: Target[]
  onChange: (ids: string[]) => void
  disabled: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const addable = options
    .filter((o) => !selected.includes(o.id))
    .map((o) => ({ value: o.id, label: o.label }))
  return (
    <section className={CARD}>
      <div className="flex items-start gap-3 border-b border-zinc-100 px-6 py-4">
        <Icon className="mt-0.5 h-4 w-4 text-prominent-purple-700" />
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        </div>
      </div>
      <div className="space-y-3 px-6 py-4">
        {children}
        {selected.length === 0 ? (
          <p className="text-sm text-zinc-500">{empty}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {selected.map((id) => (
              <li
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full bg-prominent-purple-50 px-3 py-1 text-xs font-medium text-prominent-purple-800 ring-1 ring-inset ring-prominent-purple-100"
              >
                {byId.get(id)?.label ?? 'Account no longer exists'}
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${byId.get(id)?.label ?? 'account'}`}
                    onClick={() => onChange(selected.filter((x) => x !== id))}
                    className="rounded-full p-0.5 hover:bg-prominent-purple-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!disabled && (
          <div className="max-w-md">
            <SearchableSelect
              options={addable}
              value=""
              placeholder="Add an account…"
              ariaLabel={`Add to ${title}`}
              onChange={(id) => id && onChange([...selected, id])}
            />
          </div>
        )}
      </div>
    </section>
  )
}

export default function RoleLimitsClient({
  role,
  initialScopes,
  bankAccounts,
  controlAccounts,
}: {
  role: { id: string; name: string }
  initialScopes: RoleScope[]
  bankAccounts: BankAccountOption[]
  controlAccounts: ControlAccount[]
}): React.JSX.Element {
  const locked = role.name === FOUNDER_ROLE_NAME
  const [banks, setBanks] = useState(() => idsOf(initialScopes, 'bank-account'))
  const [funds, setFunds] = useState(() => idsOf(initialScopes, 'expense-fund'))
  const [ownBranch, setOwnBranch] = useState(() =>
    initialScopes.some((s) => s.kind === 'expense-fund-own-branch')
  )
  const [specials, setSpecials] = useState(() => idsOf(initialScopes, 'special-account'))
  const [saving, setSaving] = useState(false)

  const bankTargets = useMemo(
    () => bankAccounts.map((a) => ({ id: a.id, label: bankLabel(a) })),
    [bankAccounts]
  )
  const controlTargets = useMemo(
    () => controlAccounts.map((a) => ({ id: a.id, label: `${a.number} ${a.name}` })),
    [controlAccounts]
  )

  const save = async (): Promise<void> => {
    setSaving(true)
    const scopes: RoleScope[] = [
      ...banks.map((targetId) => ({ kind: 'bank-account' as const, targetId })),
      ...funds.map((targetId) => ({ kind: 'expense-fund' as const, targetId })),
      ...(ownBranch ? [{ kind: 'expense-fund-own-branch' as const, targetId: null }] : []),
      ...specials.map((targetId) => ({ kind: 'special-account' as const, targetId })),
    ]
    const result = await setRoleScopes(role.id, scopes)
    setSaving(false)
    if (result.success) {
      showToast({ title: `Saved ${role.name}'s account limits`, status: 'success' })
    } else {
      showToast({
        title: 'Could not save the limits',
        description: result.message ?? result.error,
        status: 'error',
      })
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 pb-6 pt-6">
        <Link
          href={`/settings/roles/${role.id}`}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-prominent-purple-700"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to {role.name}
        </Link>

        <div className={`${CARD} px-6 py-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Account limits
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{role.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Which accounts this role may use on the pages its access opens. A list left empty means
            no limit: every account.
          </p>
          {locked && (
            <p className="mt-3 rounded-xl border border-prominent-purple-100 bg-prominent-purple-50/60 px-4 py-3 text-sm text-prominent-purple-900">
              The Business Owner has access to everything and carries no limits.
            </p>
          )}
        </div>

        <TargetList
          title="Bank and cash accounts"
          hint="Everywhere a bank account is listed or picked: Cash & Banking, payments, receipts, loans, transfers."
          icon={Landmark}
          empty="No limit: every bank and cash account."
          selected={banks}
          options={bankTargets}
          onChange={setBanks}
          disabled={locked}
        />

        <TargetList
          title={'Expense "Paid from"'}
          hint="Only the funds an expense may be paid from. On top of the bank and cash limit above."
          icon={Wallet}
          empty={ownBranch ? 'Only their own branch’s petty cash.' : 'No limit on "Paid from".'}
          selected={funds}
          options={bankTargets}
          onChange={setFunds}
          disabled={locked}
        >
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={ownBranch}
              disabled={locked}
              onChange={(e) => setOwnBranch(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700"
            />
            Their own branch&apos;s petty cash
          </label>
        </TargetList>

        <TargetList
          title="Special Accounts"
          hint="The Special Account control accounts this role may open, view and post to."
          icon={BookUser}
          empty="No limit: every Special Account."
          selected={specials}
          options={controlTargets}
          onChange={setSpecials}
          disabled={locked}
        />

        {!locked && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save limits'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
