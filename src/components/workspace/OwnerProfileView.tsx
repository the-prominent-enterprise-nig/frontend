import { Building2, CheckCircle2, CreditCard, Settings2, UserRound } from 'lucide-react'
import { type SessionUser } from '@/src/libs/guards/permission'

function titleCase(value?: string | null): string | null {
  if (!value) return null
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-900">{String(value)}</p>
    </div>
  )
}

export default function OwnerProfileView({ session }: { session: SessionUser }) {
  const enterprise = session.enterpriseOwner
  const subscription = enterprise?.activeSubscription
  const ownerName =
    session.fullName ||
    [session.firstName, session.lastName].filter(Boolean).join(' ') ||
    session.name ||
    'Enterprise Owner'
  const businessName =
    enterprise?.companyTradingName ||
    enterprise?.companyLegalName ||
    session.enterpriseOwnerName ||
    'Business profile'
  const enabledModules = enterprise?.businessSettings?.enabledModules?.length
    ? enterprise.businessSettings.enabledModules
    : (session.moduleAccess ?? [])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-prominent-purple-700">My Profile</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">Enterprise Owner</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-prominent-purple-50 text-prominent-purple-700">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Account Information</h2>
              <p className="text-sm text-zinc-500">Owner login and access details</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Name" value={ownerName} />
            <Field label="Email" value={session.email} />
            <Field label="Role" value="Enterprise Owner" />
            <Field label="Account status" value={titleCase(session.status)} />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Business Information</h2>
              <p className="text-sm text-zinc-500">Enterprise profile from your backend record</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Business name" value={businessName} />
            <Field label="Industry" value={enterprise?.industry} />
            <Field label="Country" value={enterprise?.country} />
            <Field label="Registration no." value={enterprise?.registrationNumber} />
            <Field label="Tax ID" value={enterprise?.taxId} />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Subscription</h2>
              <p className="text-sm text-zinc-500">Current account limits and billing state</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Plan" value={titleCase(subscription?.planCode)} />
            <Field label="Status" value={titleCase(subscription?.status)} />
            <Field label="Billing cycle" value={titleCase(subscription?.billingCycle)} />
            <Field label="User limit" value={subscription?.userLimit} />
            <Field label="Branch limit" value={subscription?.branchLimit} />
            <Field label="Next billing date" value={subscription?.nextBillingDate?.slice(0, 10)} />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Enabled Modules</h2>
              <p className="text-sm text-zinc-500">Workspace access available to this enterprise</p>
            </div>
          </div>

          {enabledModules.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {enabledModules.map((module) => (
                <span
                  key={module}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {titleCase(module)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-zinc-500">Module settings are coming soon.</p>
          )}
        </section>

        <section className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-zinc-950">Contact / Settings</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Owner contact preferences and business profile editing are coming soon.
          </p>
        </section>
      </div>
    </main>
  )
}
