'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react'
import { posCustomersApi } from '@/src/libs/api/pos-customers'
import type { Customer } from '@/src/schema/crm/types'

const SOURCE_LABELS: Record<string, string> = {
  pos_walkin: 'POS walk-in',
  sales: 'Sales',
  referral: 'Referral',
  online: 'Online',
  walk_in: 'Walk-in',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-zinc-100 text-zinc-600',
  blocked: 'bg-red-50 text-red-700',
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** One label/value pair. Renders an em dash rather than collapsing, so the
 * cashier can see that a field is genuinely empty instead of wondering
 * whether it failed to load. */
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="truncate text-sm text-zinc-900">{value?.toString().trim() || '—'}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-800">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Read-only customer profile for POS. The list used to offer only "Edit",
 * so the only way to read someone's details was to open a form that could
 * change them — this is the view for looking, with editing one click away
 * for anyone holding pos:customers:update.
 *
 * Deliberately narrower than CRM's Customer 360: no leads, interactions,
 * reminders or ledger. Those need crm:* permissions a cashier does not
 * hold, and none of them belong at a till.
 */
export default function PosCustomerDetail({ id, canUpdate }: { id: string; canUpdate: boolean }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    posCustomersApi
      .get(id)
      .then((res) => {
        if (cancelled) return
        setLoading(false)
        if (res.success && res.data) setCustomer(res.data)
        else setError(res.error ?? 'Could not load this customer')
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
        setError('Could not load this customer')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-10 text-sm text-zinc-500 md:px-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading customer…
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || 'Customer not found'}
        </p>
        <Link
          href="/pos/customers"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>
      </div>
    )
  }

  const c = customer
  const fullName =
    [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ').trim() || c.name

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 lg:px-8">
      <Link
        href="/pos/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        {/* min-w-0 so a long name truncates rather than pushing Edit off the
            row on a narrow till screen. */}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-zinc-900">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-zinc-500">{c.customerCode}</span>
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                STATUS_STYLES[c.status] ?? 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {c.status}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-500">
              {SOURCE_LABELS[c.sourceChannel] ?? c.sourceChannel}
            </span>
          </div>
        </div>
        {canUpdate && (
          <Link
            href={`/pos/customers/${c.id}/edit`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        )}
      </div>

      <div className="space-y-3">
        <Section title="Contact">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Phone" value={c.phone} />
            <Field label="Email" value={c.email} />
            <Field label="Address" value={c.address} />
            <Field label="Branch" value={c.branch?.name} />
          </dl>
        </Section>

        <Section title="Profile">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name" value={fullName} />
            <Field label="Birthday" value={formatDate(c.birthday)} />
            <Field label="Customer type" value={c.customerType} />
            {c.companyName ? <Field label="Company" value={c.companyName} /> : null}
            {c.employeeNumber ? <Field label="Employee number" value={c.employeeNumber} /> : null}
            <Field label="Payment terms" value={c.paymentTerms} />
          </dl>
        </Section>

        <Section title="Co-makers">
          {c.coMakers && c.coMakers.length > 0 ? (
            <ul className="divide-y divide-zinc-100">
              {c.coMakers.map((cm) => (
                <li key={cm.id} className="py-2 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-zinc-900">{cm.name}</p>
                  <p className="text-xs text-zinc-500">
                    {[cm.relationship, cm.contactNumber, cm.email].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              No co-maker on file. One can be added when raising a credit application.
            </p>
          )}
        </Section>

        <Section title="Identification">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="ID type" value={c.idType} />
            <Field label="ID number" value={c.idNumber} />
            <Field label="ID document" value={c.idDocumentFile?.originalName} />
            <Field label="Tax ID" value={c.taxId} />
          </dl>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs">
            {c.consentGiven ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-zinc-600">
                  Data privacy consent given{' '}
                  {c.consentGivenAt ? `on ${formatDate(c.consentGivenAt)}` : ''}
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-zinc-600">No data privacy consent recorded</span>
              </>
            )}
          </p>
        </Section>

        {c.notes ? (
          <Section title="Notes">
            <p className="whitespace-pre-wrap text-sm text-zinc-700">{c.notes}</p>
          </Section>
        ) : null}
      </div>
    </div>
  )
}
