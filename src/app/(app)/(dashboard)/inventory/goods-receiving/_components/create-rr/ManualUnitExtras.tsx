'use client'

import { useState } from 'react'
import MoneyInput from '@/src/components/ui/MoneyInput'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type { RrReturnDisposition } from '../../_actions/record-customer-return'
import { MONO } from '../../../purchase-orders/_components/procurementTokens'

export const DISPOSITION_OPTIONS: { value: RrReturnDisposition; label: string }[] = [
  { value: 'restock', label: 'Back on the shelf' },
  { value: 'quarantine', label: 'On hold (not sellable)' },
  { value: 'scrap', label: 'Written off' },
]

const CAPTION = `${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`

const INPUT = `${MONO} h-9.5 w-full rounded-lg border bg-white px-2.5 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`

type Props = {
  mode: 'customer_return' | 'repossession'
  amount?: number
  onAmount: (value: number | undefined) => void
  /** Return only. */
  disposition?: RrReturnDisposition
  onDisposition?: (value: RrReturnDisposition) => void
  showErrors: boolean
}

/** A peso amount kept as typed text, so "1." survives until the next digit. */
function AmountField({
  label,
  hint,
  amount,
  onAmount,
  invalid,
}: {
  label: string
  hint: string
  amount?: number
  onAmount: (value: number | undefined) => void
  invalid: boolean
}): React.ReactElement {
  const [text, setText] = useState(amount != null ? String(amount) : '')
  return (
    <div className="min-w-0">
      <span className={CAPTION}>{label}</span>
      <MoneyInput
        value={text}
        onChange={(raw) => {
          setText(raw)
          onAmount(raw === '' ? undefined : Number(raw))
        }}
        placeholder={hint}
        aria-label={label}
        className={`${INPUT} ${invalid ? 'border-[#b42318]' : 'border-[#d3d3db]'}`}
      />
    </div>
  )
}

/**
 * The fields a hand-entered unit needs beyond Brand / Model / Serial: a return
 * credits what the customer paid and decides where the unit goes; a
 * repossession re-enters stock at its Repo Cost.
 */
export function ManualUnitExtras({
  mode,
  amount,
  onAmount,
  disposition,
  onDisposition,
  showErrors,
}: Props): React.ReactElement {
  const isReturn = mode === 'customer_return'
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      <AmountField
        label={isReturn ? 'Price paid' : 'Repo cost'}
        hint={isReturn ? 'What the customer paid' : 'What it re-enters stock at'}
        amount={amount}
        onAmount={onAmount}
        invalid={showErrors && (isReturn ? amount == null : !(Number(amount) > 0))}
      />
      {isReturn && (
        <div className="min-w-0">
          <span className={CAPTION}>What happens</span>
          <SearchableSelect
            portal
            ariaLabel="What happens to this unit"
            value={disposition ?? 'restock'}
            onChange={(value) => onDisposition?.(value as RrReturnDisposition)}
            options={DISPOSITION_OPTIONS}
          />
        </div>
      )}
    </div>
  )
}
