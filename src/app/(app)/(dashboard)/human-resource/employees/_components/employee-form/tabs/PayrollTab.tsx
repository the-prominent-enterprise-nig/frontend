'use client'

import { BadgeDollarSign, Coins, RefreshCcw, TrendingDown, Wallet } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Input } from 'react-aria-components'
import { FormData } from '../types'
import {
  ControlledSelect,
  Field,
  SectionLabel,
  SelectWrapper,
  inputCls,
  parseNumericInput,
} from '../ui'

export function PayrollTab() {
  const {
    control,
    formState: { errors },
  } = useFormContext<FormData>()

  return (
    <>
      <SectionLabel>Allowance</SectionLabel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Allowance"
          icon={<Wallet className="w-3.5 h-3.5" />}
          error={errors.allowance?.message}
        >
          <Controller
            name="allowance"
            control={control}
            render={({ field }) => (
              <Input
                type="text"
                inputMode="decimal"
                className={inputCls(errors.allowance?.message)}
                placeholder="0.00"
                value={field.value?.toString() ?? ''}
                onChange={(e) => parseNumericInput(e.target.value, field.onChange)}
              />
            )}
          />
        </Field>

        <Field label="Payout Cycle" icon={<RefreshCcw className="w-3.5 h-3.5" />}>
          <SelectWrapper>
            <ControlledSelect name="allowancePayoutCycle" defaultValue="FirstCycle">
              <option value="FirstCycle">First Cycle</option>
              <option value="SecondCycle">Second Cycle</option>
            </ControlledSelect>
          </SelectWrapper>
        </Field>
      </div>

      <SectionLabel>Loan</SectionLabel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Loan Amount"
          icon={<BadgeDollarSign className="w-3.5 h-3.5" />}
          error={errors.loan?.message}
        >
          <Controller
            name="loan"
            control={control}
            render={({ field }) => (
              <Input
                type="text"
                inputMode="decimal"
                className={inputCls(errors.loan?.message)}
                placeholder="0.00"
                value={field.value?.toString() ?? ''}
                onChange={(e) => parseNumericInput(e.target.value, field.onChange)}
              />
            )}
          />
        </Field>

        <Field
          label="Loan Deduction"
          icon={<TrendingDown className="w-3.5 h-3.5" />}
          error={errors.loanDeduction?.message}
        >
          <Controller
            name="loanDeduction"
            control={control}
            render={({ field }) => (
              <Input
                type="text"
                inputMode="decimal"
                className={inputCls(errors.loanDeduction?.message)}
                placeholder="0.00"
                value={field.value?.toString() ?? ''}
                onChange={(e) => parseNumericInput(e.target.value, field.onChange)}
              />
            )}
          />
        </Field>
      </div>

      <SectionLabel>SILC</SectionLabel>

      <Field
        label="SILC Amount"
        icon={<Coins className="w-3.5 h-3.5" />}
        error={errors.silc?.message}
      >
        <Controller
          name="silc"
          control={control}
          render={({ field }) => (
            <Input
              type="text"
              inputMode="decimal"
              className={inputCls(errors.silc?.message)}
              placeholder="0.00"
              value={field.value?.toString() ?? ''}
              onChange={(e) => parseNumericInput(e.target.value, field.onChange)}
            />
          )}
        />
      </Field>
    </>
  )
}
