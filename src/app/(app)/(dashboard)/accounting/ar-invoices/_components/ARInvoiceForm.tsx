'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Loader2, ShieldCheck, User } from 'lucide-react'
import {
  ARInvoices,
  fmtMoney,
  type ARInvoice,
  type ARInvoiceCustomerResult,
} from '@/src/libs/data/AccountingV2Data'
import { useMe } from '@/src/hooks/useMe'
import { useOutputVatCodes } from '@/src/hooks/useOutputVatCodes'
import { can } from '@/src/libs/guards/permission'
import {
  AR_OUTPUT_VAT_CODES,
  OUTPUT_VAT_EXEMPT,
  OUTPUT_VAT_STANDARD,
  RESTRICTED_VAT_PERMISSION,
  isRestrictedOutputVat,
  restrictedKind,
  shortVatName,
} from '@/src/libs/tax/output-vat'
import { TaxOverrideBox } from '@/src/components/accounting/TaxOverride'
import {
  TAX_OVERRIDE_PERMISSION,
  changeOf,
  freshChanges,
  reasonMissingMessage,
  reasonOk,
  standingFor,
} from '@/src/libs/tax/tax-override'
import Field from '../../_shared/Field'

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100 disabled:bg-gray-50 disabled:text-gray-500'

const today = () => new Date().toISOString().slice(0, 10)
const inThirtyDays = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

/**
 * Raise or edit a draft AR invoice — its own page (the client does not want
 * create/edit flows in a dialog). Scenario 69 Part F adds the invoice's output
 * VAT class: VATable by default, or zero-rated / VAT-exempt, which carry no
 * tax, need the certificate they rest on, and can only be saved by someone
 * holding accounting:ar-invoices:restricted-vat — who is then recorded as the
 * approver. The server enforces every rule; this form only keeps the person
 * from walking into a refusal.
 */
export default function ARInvoiceForm({ id }: { id?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const presetCustomerId = params.get('customerId') ?? ''
  const { data: me } = useMe()
  const canApprove = !!me && can(me, RESTRICTED_VAT_PERMISSION)
  // Scenario 69 Part I — a class other than the one the invoice starts on is an
  // override: it needs this permission, and a reason.
  const canOverride = !!me && can(me, TAX_OVERRIDE_PERMISSION)
  const { options: vatChoices } = useOutputVatCodes(AR_OUTPUT_VAT_CODES)

  const [initial, setInitial] = useState<ARInvoice | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    customerId: presetCustomerId,
    invoiceDate: today(),
    dueDate: inThirtyDays(),
    description: '',
    subtotal: '',
    taxAmount: '',
  })
  // The output VAT class and the certificate a restricted one rests on.
  const [vatCode, setVatCode] = useState<string>(OUTPUT_VAT_STANDARD)
  const [ref, setRef] = useState('')
  // The customer's own profile decides where the class starts (Part I).
  const [customerExempt, setCustomerExempt] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  // Customer picker — a search box scoped to accounting:ar-invoices:read (see
  // ARInvoices.searchCustomers), so an Accountant without crm:customers:read
  // can still pick one.
  const [customerLabel, setCustomerLabel] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<ARInvoiceCustomerResult[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  // Editing: load the draft once and fill the form from it.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const res = await ARInvoices.get(id)
      if (cancelled) return
      if (!res.success || !res.data) {
        setLoadError(res.error || 'Could not load this invoice.')
        setLoading(false)
        return
      }
      const inv = res.data
      setInitial(inv)
      setForm({
        customerId: inv.customerId,
        invoiceDate: inv.invoiceDate?.slice(0, 10) ?? today(),
        dueDate: inv.dueDate?.slice(0, 10) ?? inThirtyDays(),
        description: inv.description ?? '',
        subtotal: String(inv.subtotal ?? ''),
        taxAmount: String(inv.taxAmount ?? ''),
      })
      setCustomerLabel(inv.customer?.name ?? '')
      setCustomerExempt(!!inv.customer?.isTaxExempt)
      // A draft from before classification carries no code: read it as the
      // ordinary class unless it carries no VAT, when there is nothing to guess.
      setVatCode(inv.outputVatCode ?? (inv.taxAmount > 0 ? OUTPUT_VAT_STANDARD : ''))
      setRef(inv.taxExemptionRef ?? '')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  // A customer arriving by link (the customer's own page) is filled in.
  useEffect(() => {
    if (id || !presetCustomerId) return
    let cancelled = false
    ;(async () => {
      const res = await ARInvoices.getCustomerById(presetCustomerId)
      const customer = res.data?.[0]
      if (cancelled || !customer) return
      setCustomerLabel(customer.name)
      applyCustomerDefault(customer)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [id, presetCustomerId])

  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      setCustomerSearchOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      const res = await ARInvoices.searchCustomers(customerSearch.trim())
      setCustomerResults(res.data ?? [])
      setCustomerSearchOpen(true)
      setSearchingCustomers(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const rateOf = (code: string) => vatChoices.find((c) => c.code === code)?.ratePercent ?? 12
  const restricted = isRestrictedOutputVat(vatCode)
  const taxFor = (subtotal: number, code: string) =>
    isRestrictedOutputVat(code) ? 0 : +(subtotal * (rateOf(code) / 100)).toFixed(2)

  /** A customer registered as tax-exempt starts a new invoice VAT-exempt, with
   * the certificate on their profile filled in. Only a default. */
  function applyCustomerDefault(customer: ARInvoiceCustomerResult) {
    setCustomerExempt(!!customer.isTaxExempt)
    if (id || !customer.isTaxExempt) return
    setVatCode(OUTPUT_VAT_EXEMPT)
    setRef(customer.taxExemptionRef ?? '')
    setForm((f) => ({ ...f, taxAmount: '0' }))
  }

  const onSubtotalChange = (val: string) => {
    const subtotal = Number(val) || 0
    // Tax follows the subtotal at the class's rate, and stays freely editable
    // afterwards — except for a class that carries none.
    setForm((f) => ({ ...f, subtotal: val, taxAmount: String(taxFor(subtotal, vatCode)) }))
  }

  function chooseClass(code: string) {
    if (code === vatCode) return
    setVatCode(code)
    setRef('') // the certificate belongs to the class it supports
    setForm((f) => ({ ...f, taxAmount: String(taxFor(Number(f.subtotal) || 0, code)) }))
  }

  // Already approved exactly as it stands: saving something else keeps it.
  const approvalStands =
    !!initial &&
    !!initial.outputVatApprovedBy &&
    initial.outputVatCode === vatCode &&
    (initial.taxExemptionRef ?? '') === ref.trim()
  const needsApprover = restricted && !approvalStands
  // Scenario 69 Part I — the class the invoice would start on, against the one
  // it has: a departure needs its reason, from someone who may (a departure that
  // is already on record stands as it was made).
  const defaultVat = customerExempt ? OUTPUT_VAT_EXEMPT : OUTPUT_VAT_STANDARD
  const change = changeOf('OUTPUT_VAT_CODE', defaultVat, vatCode)
  const onRecord = change ? standingFor(initial?.taxOverride, change) : undefined
  const freshOverrides = change ? freshChanges([change], initial?.taxOverride) : []
  const overrideBlocked = freshOverrides.length > 0 && !canOverride
  const blocked = (needsApprover && !canApprove) || overrideBlocked
  const notEditable = !!initial && initial.status !== 'DRAFT'

  const total = (Number(form.subtotal) || 0) + (Number(form.taxAmount) || 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // The customer field is a search box, not a native <select> — its visible
    // text isn't what's submitted, so `required` on the input alone would let a
    // typed-but-never-selected name through with customerId still empty.
    if (!form.customerId) {
      setError('Pick the customer from the search results.')
      return
    }
    if (restricted && !ref.trim()) {
      setError(
        `Enter the certificate or reference that supports this ${restrictedKind(vatCode)} invoice.`
      )
      return
    }
    if (freshOverrides.length > 0 && !reasonOk(overrideReason)) {
      setError(reasonMissingMessage(freshOverrides))
      return
    }
    setSaving(true)
    const payload = {
      ...form,
      subtotal: Number(form.subtotal),
      taxAmount: Number(form.taxAmount || 0),
      outputVatCode: vatCode || undefined,
      taxExemptionRef: restricted ? ref.trim() : undefined,
      taxOverrideReason: freshOverrides.length > 0 ? overrideReason.trim() : undefined,
    }
    const res = id ? await ARInvoices.update(id, payload) : await ARInvoices.create(payload)
    setSaving(false)
    if (!res.success) {
      setError(res.error || res.message || 'The invoice could not be saved.')
      return
    }
    router.push(`/accounting/ar-invoices/${res.data?.id ?? id}`)
  }

  const backHref = presetCustomerId
    ? `/accounting/ar-invoices/customer/${presetCustomerId}`
    : initial
      ? `/accounting/ar-invoices/${initial.id}`
      : '/accounting/ar-invoices'

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-6 py-8 text-sm text-gray-500 lg:px-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading invoice…
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="px-6 py-5 lg:px-10">
        <Link
          href="/accounting/ar-invoices"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AR invoices
        </Link>
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {loadError}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 lg:px-10" data-testid="ar-invoice-form">
      <div className="sticky top-0 z-20 -mx-6 -mt-5 mb-4 border-b border-zinc-200 bg-zinc-50/95 px-6 pb-3 pt-5 backdrop-blur lg:-mx-10 lg:px-10">
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-prominent-purple-900">
              {initial ? `Edit Invoice ${initial.invoiceNumber}` : 'New Invoice'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Raise a receivable against a customer. Sending the invoice posts it to the GL.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <Link
              href={backHref}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || blocked || notEditable}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700"
          >
            {error}
          </div>
        )}
      </div>

      {notEditable && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Only a draft invoice can be edited. Cancel this one and raise a new invoice if something
          has to change.
        </p>
      )}

      <div className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-3">
          <Field label="Customer *">
            <div className="relative">
              <input
                required
                className={`${inputClass} pr-7`}
                placeholder="Search by name or phone…"
                value={customerLabel || customerSearch}
                disabled={notEditable}
                onChange={(e) => {
                  setCustomerLabel('')
                  setForm((f) => ({ ...f, customerId: '' }))
                  setCustomerSearch(e.target.value)
                }}
                onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
                onFocus={() => customerResults.length > 0 && setCustomerSearchOpen(true)}
              />
              {searchingCustomers && (
                <Loader2
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                />
              )}
              {customerSearchOpen && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {customerResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">No customers found</p>
                  ) : (
                    customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onMouseDown={() => {
                          setForm((f) => ({ ...f, customerId: c.id }))
                          setCustomerLabel(c.name)
                          setCustomerSearch('')
                          setCustomerSearchOpen(false)
                          applyCustomerDefault(c)
                        }}
                      >
                        <User size={13} className="shrink-0 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </Field>
          <Field label="Invoice Date *">
            <input
              required
              type="date"
              disabled={notEditable}
              value={form.invoiceDate}
              onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Due Date *">
            <input
              required
              type="date"
              disabled={notEditable}
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Description">
          <input
            disabled={notEditable}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={inputClass}
          />
        </Field>

        <section
          className="rounded-xl border border-gray-200 bg-white p-4"
          data-testid="invoice-vat-treatment"
        >
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck
              size={15}
              className={restricted ? 'text-green-600' : 'text-gray-500'}
              aria-hidden
            />
            <h2 className="text-sm font-semibold text-prominent-purple-900">VAT treatment</h2>
          </div>
          <div
            role="radiogroup"
            aria-label="VAT treatment"
            className="inline-grid grid-flow-col gap-1 rounded-lg bg-gray-100 p-0.5"
          >
            {vatChoices.map((choice) => {
              const selected = vatCode === choice.code
              // A restricted class can only be picked by someone who may approve
              // it, and any class other than the one the invoice starts on by
              // someone who may override — unless it is the class the draft
              // already carries.
              const needsApproval = choice.requiresApproval && !canApprove
              const needsOverride = choice.code !== defaultVat && !canOverride
              const unavailable = (needsApproval || needsOverride) && !selected
              return (
                <button
                  key={choice.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={notEditable || unavailable}
                  data-testid={`invoice-vat-${choice.code}`}
                  title={
                    unavailable
                      ? needsApproval
                        ? 'Needs the restricted VAT permission to approve'
                        : 'Changing the class from its default needs the tax-code override permission'
                      : choice.name
                  }
                  onClick={() => chooseClass(choice.code)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? choice.requiresApproval
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {shortVatName(choice.code)}
                </button>
              )
            })}
          </div>
          {!vatCode && (
            <p className="mt-2 text-xs text-gray-500">
              This draft was never classified. Pick a treatment to classify it.
            </p>
          )}

          {restricted && (
            <div className="mt-3 grid gap-3 lg:grid-cols-2" data-testid="invoice-vat-restricted">
              <Field
                label={`Certificate / reference * (supports the ${restrictedKind(vatCode)} treatment)`}
              >
                <input
                  disabled={notEditable}
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="e.g. BIR exemption certificate no."
                  className={inputClass}
                />
              </Field>
              <div className="flex items-end">
                {approvalStands ? (
                  <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                    <ShieldCheck size={13} />
                    <span>
                      Approved by{' '}
                      <span className="font-semibold">
                        {initial?.outputVatApprovedByName ?? 'an approver'}
                      </span>
                    </span>
                  </p>
                ) : canApprove ? (
                  <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                    <ShieldCheck size={13} />
                    <span>Saving this records you as the approver.</span>
                  </p>
                ) : (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                  >
                    <AlertTriangle size={13} />
                    <span>
                      A {restrictedKind(vatCode)} invoice needs someone with the restricted-VAT
                      permission to save it.
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {(freshOverrides.length > 0 || onRecord) && (
            <div className="mt-3">
              <TaxOverrideBox
                testId="invoice-override"
                changes={freshOverrides}
                standing={onRecord ? [onRecord] : []}
                canOverride={canOverride}
                reason={overrideReason}
                onReason={setOverrideReason}
              />
            </div>
          )}
        </section>

        <div className="grid gap-3 lg:grid-cols-3">
          <Field label="Subtotal *">
            <input
              required
              type="number"
              step="0.01"
              disabled={notEditable}
              value={form.subtotal}
              onChange={(e) => onSubtotalChange(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={restricted ? 'Tax (none — this treatment carries no VAT)' : 'Tax'}>
            <input
              type="number"
              step="0.01"
              disabled={notEditable || restricted}
              value={restricted ? '0' : form.taxAmount}
              onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))}
              className={inputClass}
              title={
                restricted
                  ? 'A zero-rated or exempt invoice carries no VAT'
                  : 'Auto-calculated at the class rate — editable'
              }
            />
          </Field>
          <div className="flex items-end justify-end pb-2 text-sm">
            <span className="text-gray-500">Total: </span>
            <span className="ml-1 font-semibold text-gray-900" data-testid="invoice-total">
              {fmtMoney(total)}
            </span>
          </div>
        </div>
      </div>
    </form>
  )
}
