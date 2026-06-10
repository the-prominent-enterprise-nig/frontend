'use client'

import { AlertCircle, ChevronDown } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { Input } from 'react-aria-components'
import type { FormData } from '../../types'

export function parseNumericInput(value: string, onChange: (v: number | undefined) => void) {
  const v = value.replace(/[^0-9.]/g, '')
  onChange(v === '' ? undefined : Number(v))
}

export const inputCls = (error?: string) =>
  [
    'w-full px-3 py-2.5 rounded-lg border text-sm text-gray-800 bg-white outline-none transition-all',
    'placeholder:text-gray-300',
    'text-base sm:text-sm',
    'focus:ring-2 focus:ring-purple-500 focus:border-purple-500',
    error
      ? 'border-red-400 bg-red-50 focus:ring-red-300 focus:border-red-400'
      : 'border-gray-200 hover:border-gray-300',
  ].join(' ')

export const selectCls = (error?: string, disabled?: boolean) =>
  [
    'w-full px-3 py-2.5 pr-9 rounded-lg border text-gray-800 bg-white outline-none transition-all appearance-none',
    'text-base sm:text-sm',
    disabled
      ? 'opacity-50 cursor-not-allowed bg-gray-50'
      : 'focus:ring-2 focus:ring-purple-500 focus:border-purple-500',
    error
      ? 'border-red-400 bg-red-50 focus:ring-red-300 focus:border-red-400'
      : 'border-gray-200 hover:border-gray-300',
  ].join(' ')

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  icon?: React.ReactNode
  children: React.ReactNode
}

export function Field({ label, required, error, icon, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {icon && <span className="text-gray-400">{icon}</span>}
        {label}
        {required && <span className="text-purple-600 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1.5 mt-1">
      {children}
    </p>
  )
}

export function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}

interface ControlledInputProps extends Omit<React.ComponentProps<typeof Input>, 'name'> {
  name: keyof FormData
  optional?: boolean
}

export function ControlledInput({ name, optional, ...inputProps }: ControlledInputProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<FormData>()
  const error = errors[name]?.message as string | undefined
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Input
          {...field}
          {...inputProps}
          value={optional ? ((field.value as string | undefined) ?? '') : (field.value as string)}
          onChange={(e) => {
            const v = e.target.value
            field.onChange(optional ? v || undefined : v)
          }}
          className={inputCls(error) + (inputProps.className ? ` ${inputProps.className}` : '')}
        />
      )}
    />
  )
}

interface ControlledSelectProps {
  name: keyof FormData
  optional?: boolean
  defaultValue?: string
  disabled?: boolean
  children: React.ReactNode
}

export function ControlledSelect({
  name,
  optional,
  defaultValue,
  disabled,
  children,
}: ControlledSelectProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<FormData>()
  const error = errors[name]?.message as string | undefined
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <select
          className={selectCls(error, disabled)}
          {...field}
          disabled={disabled}
          value={(field.value as string | undefined) ?? defaultValue ?? ''}
          onChange={(e) => field.onChange(optional ? e.target.value || undefined : e.target.value)}
        >
          {children}
        </select>
      )}
    />
  )
}
