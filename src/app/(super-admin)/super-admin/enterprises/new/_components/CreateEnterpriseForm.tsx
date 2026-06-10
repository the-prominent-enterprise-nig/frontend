'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import countries from 'world-countries'

// ─── Country options ────────────────────────────────────────────────────────

const COUNTRY_OPTIONS = countries
  .map((c) => ({ value: c.cca2, label: `${c.flag} ${c.name.common}` }))
  .sort((a, b) => a.label.localeCompare(b.label))

// Map country code → primary currency code
const COUNTRY_CURRENCY_MAP: Record<string, string> = {}
countries.forEach((c) => {
  const codes = Object.keys(c.currencies ?? {})
  if (codes.length > 0) COUNTRY_CURRENCY_MAP[c.cca2] = codes[0]
})

// Build unique sorted currency options
const CURRENCY_OPTIONS = Array.from(
  new Map(
    countries.flatMap((c) =>
      Object.entries(c.currencies ?? {}).map(([code, info]) => [
        code,
        {
          value: code,
          label: `${code} — ${(info as { name: string; symbol: string }).name} (${(info as { name: string; symbol: string }).symbol})`,
        },
      ])
    )
  ).values()
).sort((a, b) => a.value.localeCompare(b.value))

// ─── Module definitions ─────────────────────────────────────────────────────

const ALL_MODULES = [
  { code: 'hr', label: 'HR & Payroll', description: 'Employee management, attendance, payroll' },
  {
    code: 'attendance',
    label: 'Attendance & Time',
    description: 'Time tracking and attendance logs',
  },
  { code: 'leave', label: 'Leave Management', description: 'Leave requests and approvals' },
  { code: 'payroll', label: 'Payroll', description: 'Payroll processing and payslips' },
  {
    code: 'accounting',
    label: 'Accounting',
    description: 'General ledger, invoices, transactions',
  },
  {
    code: 'procurement',
    label: 'Procurement',
    description: 'Purchase orders and supplier management',
  },
  { code: 'inventory', label: 'Inventory', description: 'Stock management and warehousing' },
  { code: 'pos', label: 'Point of Sale', description: 'POS terminals and transactions' },
  { code: 'crm', label: 'CRM', description: 'Customer relationship management' },
  { code: 'sales', label: 'Sales & Orders', description: 'Quotations and sales orders' },
  {
    code: 'queue-management',
    label: 'Queue Management',
    description: 'Customer queue and ticketing',
  },
  {
    code: 'project-management',
    label: 'Project Management',
    description: 'Projects and task tracking',
  },
]

const DEFAULT_MODULES = new Set(['hr', 'attendance', 'leave', 'payroll'])

// ─── Types ──────────────────────────────────────────────────────────────────

interface Plan {
  code: string
  label: string
  userLimit: number
  branchLimit: number
}

interface Step1 {
  companyLegalName: string
  companyTradingName: string
  industry: string
  country: string
  currency: string
}

interface Step2 {
  contactPerson: string
  adminEmail: string
  mobileNumber: string
  planCode: string
  userLimit: number
  branchLimit: number
}

// ─── Shared select styles ────────────────────────────────────────────────────

const selectStyles = {
  control: (base: object, state: { isFocused: boolean }) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#818cf8' : '#e4e4e7',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(129,140,248,0.2)' : 'none',
    '&:hover': { borderColor: '#a1a1aa' },
    fontSize: '0.875rem',
    minHeight: '2.5rem',
  }),
  option: (base: object, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    fontSize: '0.875rem',
    backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#eef2ff' : 'white',
    color: state.isSelected ? 'white' : '#18181b',
  }),
  menu: (base: object) => ({ ...base, borderRadius: '0.75rem', overflow: 'hidden', zIndex: 50 }),
  placeholder: (base: object) => ({ ...base, color: '#a1a1aa' }),
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  error,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  maxLength?: number
  error?: string
}) {
  return (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 ${error ? 'border-red-400' : 'border-zinc-200 focus:border-indigo-400'}`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  error,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  error?: string
}) {
  return (
    <div>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${error ? 'border-red-400' : 'border-zinc-200 focus:border-indigo-400'}`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS = ['Business Details', 'Contact & Admin', 'Module Access']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center gap-0">
      {STEPS.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-zinc-100 text-zinc-400'}`}
              >
                {done ? <Check className="h-4 w-4" /> : step}
              </div>
              <span
                className={`text-xs font-medium ${active ? 'text-zinc-900' : done ? 'text-zinc-500' : 'text-zinc-400'}`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mb-5 h-px w-16 transition-colors sm:w-24 ${done ? 'bg-indigo-600' : 'bg-zinc-200'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CreateEnterpriseForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [industryOptions, setIndustryOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    fetch('/api/super-admin/plans')
      .then((r) => r.json())
      .then((data: Plan[]) => setPlans(data))
      .catch(() => {})

    fetch('/api/super-admin/industries')
      .then((r) => r.json())
      .then((data: string[]) => setIndustryOptions(data.map((i) => ({ value: i, label: i }))))
      .catch(() => {})
  }, [])

  // Step 1 state
  const [s1, setS1] = useState<Step1>({
    companyLegalName: '',
    companyTradingName: '',
    industry: '',
    country: 'PH',
    currency: 'PHP',
  })
  const [s1Errors, setS1Errors] = useState<Partial<Record<keyof Step1, string>>>({})
  const [currencyManuallySet, setCurrencyManuallySet] = useState(false)

  // Step 2 state
  const [s2, setS2] = useState<Step2>({
    contactPerson: '',
    adminEmail: '',
    mobileNumber: '',
    planCode: '',
    userLimit: 10,
    branchLimit: 3,
  })
  const [s2Errors, setS2Errors] = useState<Partial<Record<keyof Step2, string>>>({})

  // Step 3 state
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set(DEFAULT_MODULES))

  function setField1<K extends keyof Step1>(key: K, value: Step1[K]) {
    setS1((prev) => ({ ...prev, [key]: value }))
    setS1Errors((prev) => ({ ...prev, [key]: undefined }))
  }

  function setField2<K extends keyof Step2>(key: K, value: Step2[K]) {
    setS2((prev) => ({ ...prev, [key]: value }))
    setS2Errors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleModule(code: string) {
    setEnabledModules((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function validateStep1(): boolean {
    const errors: Partial<Record<keyof Step1, string>> = {}
    if (!s1.companyLegalName.trim()) errors.companyLegalName = 'Legal name is required'
    if (!s1.industry.trim()) errors.industry = 'Industry is required'
    if (!s1.country.trim()) errors.country = 'Country is required'
    setS1Errors(errors)
    return Object.keys(errors).length === 0
  }

  function validateStep2(): boolean {
    const errors: Partial<Record<keyof Step2, string>> = {}
    if (!s2.contactPerson.trim()) errors.contactPerson = 'Contact person name is required'
    if (!s2.adminEmail.trim()) errors.adminEmail = 'Admin email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s2.adminEmail))
      errors.adminEmail = 'Enter a valid email address'
    if (s2.userLimit < 1) errors.userLimit = 'Must be at least 1'
    if (s2.branchLimit < 1) errors.branchLimit = 'Must be at least 1'
    setS2Errors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit() {
    if (enabledModules.size === 0) {
      toast.error('Enable at least one module before submitting.')
      return
    }
    setSaving(true)
    try {
      const body = {
        companyLegalName: s1.companyLegalName.trim(),
        companyTradingName: s1.companyTradingName.trim() || undefined,
        industry: s1.industry.trim(),
        country: s1.country,
        currency: s1.currency.toUpperCase() || 'PHP',
        contactPerson: s2.contactPerson.trim(),
        ownerEmail: s2.adminEmail.trim(),
        mobileNumber: s2.mobileNumber.trim() || undefined,
        planCode: s2.planCode.trim() || undefined,
        userLimit: s2.userLimit,
        branchLimit: s2.branchLimit,
        enabledModules: [...enabledModules],
      }

      const res = await fetch('/api/super-admin/enterprises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json()) as { message?: string | string[] }
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : (data.message ?? 'Failed to create business')
        )
      }

      const result = (await res.json()) as { enterprise?: { id: string } }
      toast.success('Business created successfully')
      router.push(`/super-admin/enterprises/${result.enterprise?.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <StepIndicator current={step} />

      {/* Step 1: Business Details */}
      {step === 1 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-zinc-900">Business Details</h2>
          <div className="space-y-4">
            <div>
              <FieldLabel required>Company Legal Name</FieldLabel>
              <Input
                value={s1.companyLegalName}
                onChange={(v) => setField1('companyLegalName', v)}
                placeholder="Acme Corporation Inc."
                error={s1Errors.companyLegalName}
              />
            </div>
            <div>
              <FieldLabel>Company Trading Name</FieldLabel>
              <Input
                value={s1.companyTradingName}
                onChange={(v) => setField1('companyTradingName', v)}
                placeholder="Acme (optional)"
              />
            </div>
            <div>
              <FieldLabel required>Industry</FieldLabel>
              <CreatableSelect
                options={industryOptions}
                value={s1.industry ? { value: s1.industry, label: s1.industry } : null}
                onChange={(opt) => {
                  const val = opt?.value ?? ''
                  setField1('industry', val)
                  if (opt && !industryOptions.find((o) => o.value === val)) {
                    setIndustryOptions((prev) => [...prev, { value: val, label: val }])
                  }
                }}
                placeholder="e.g. Retail, Healthcare, Technology"
                formatCreateLabel={(input) => `Add "${input}"`}
                styles={selectStyles}
                isClearable
              />
              {s1Errors.industry && (
                <p className="mt-1 text-xs text-red-500">{s1Errors.industry}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Country</FieldLabel>
                <Select
                  options={COUNTRY_OPTIONS}
                  value={COUNTRY_OPTIONS.find((o) => o.value === s1.country) ?? null}
                  onChange={(opt) => {
                    const code = opt?.value ?? ''
                    setField1('country', code)
                    if (!currencyManuallySet && code) {
                      const autoCode = COUNTRY_CURRENCY_MAP[code]
                      if (autoCode) setField1('currency', autoCode)
                    }
                  }}
                  placeholder="Select country"
                  styles={selectStyles}
                  isSearchable
                />
                {s1Errors.country && (
                  <p className="mt-1 text-xs text-red-500">{s1Errors.country}</p>
                )}
              </div>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <Select
                  options={CURRENCY_OPTIONS}
                  value={CURRENCY_OPTIONS.find((o) => o.value === s1.currency) ?? null}
                  onChange={(opt) => {
                    setCurrencyManuallySet(true)
                    setField1('currency', opt?.value ?? '')
                  }}
                  placeholder="Select currency"
                  styles={selectStyles}
                  isSearchable
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                if (validateStep1()) setStep(2)
              }}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Next: Contact & Admin →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Contact & Admin */}
      {step === 2 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-zinc-900">Contact & Admin</h2>
          <div className="space-y-4">
            <div>
              <FieldLabel required>Contact Person / Admin Name</FieldLabel>
              <Input
                value={s2.contactPerson}
                onChange={(v) => setField2('contactPerson', v)}
                placeholder="Juan Dela Cruz"
                error={s2Errors.contactPerson}
              />
            </div>
            <div>
              <FieldLabel required>Admin Email</FieldLabel>
              <Input
                value={s2.adminEmail}
                onChange={(v) => setField2('adminEmail', v)}
                type="email"
                placeholder="owner@company.com"
                error={s2Errors.adminEmail}
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                An account will be created and an invitation sent to this address.
              </p>
            </div>
            <div>
              <FieldLabel>Mobile Number</FieldLabel>
              <Input
                value={s2.mobileNumber}
                onChange={(v) => setField2('mobileNumber', v)}
                placeholder="+63 912 345 6789 (optional)"
              />
            </div>
            <div>
              <FieldLabel>Plan</FieldLabel>
              <select
                value={s2.planCode}
                onChange={(e) => {
                  const plan = plans.find((p) => p.code === e.target.value)
                  setField2('planCode', e.target.value)
                  if (plan) {
                    setField2('userLimit', plan.userLimit)
                    setField2('branchLimit', plan.branchLimit)
                  }
                }}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Select a plan (defaults to Trial)</option>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label} — {p.userLimit >= 9999 ? 'Unlimited' : p.userLimit} users /{' '}
                    {p.branchLimit >= 9999 ? 'Unlimited' : p.branchLimit} branches
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>User Limit</FieldLabel>
                <NumberInput
                  value={s2.userLimit}
                  onChange={(v) => setField2('userLimit', v)}
                  min={1}
                  error={s2Errors.userLimit}
                />
              </div>
              <div>
                <FieldLabel>Branch Limit</FieldLabel>
                <NumberInput
                  value={s2.branchLimit}
                  onChange={(v) => setField2('branchLimit', v)}
                  min={1}
                  error={s2Errors.branchLimit}
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              ← Back
            </button>
            <button
              onClick={() => {
                if (validateStep2()) setStep(3)
              }}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Next: Module Access →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Module Access */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Module Access</h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {enabledModules.size} of {ALL_MODULES.length} modules enabled
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEnabledModules(new Set(ALL_MODULES.map((m) => m.code)))}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Enable All
                </button>
                <span className="text-zinc-200">|</span>
                <button
                  onClick={() => setEnabledModules(new Set())}
                  className="text-xs font-medium text-zinc-400 hover:text-zinc-600 hover:underline"
                >
                  Disable All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 divide-y divide-zinc-50 sm:grid-cols-2">
              {ALL_MODULES.map((m, i) => {
                const enabled = enabledModules.has(m.code)
                return (
                  <label
                    key={m.code}
                    className={`flex cursor-pointer items-start gap-3.5 px-5 py-4 transition-colors hover:bg-zinc-50 ${i % 2 === 1 ? 'sm:border-l sm:border-zinc-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleModule(m.code)}
                      className="sr-only"
                    />
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${enabled ? 'border-indigo-600 bg-indigo-600' : 'border-zinc-300'}`}
                    >
                      {enabled && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${enabled ? 'text-zinc-900' : 'text-zinc-500'}`}
                      >
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">{m.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
          {enabledModules.size === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              <X className="h-4 w-4 shrink-0" />
              At least one module must be enabled.
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || enabledModules.size === 0}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Creating business…' : 'Create Business'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
