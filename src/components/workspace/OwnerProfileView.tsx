import { UserRound } from 'lucide-react'
import { type SessionUser } from '@/src/libs/guards/permission'
import { type BusinessProfile } from '@/src/libs/actions/enterprise.actions'
import CompanyProfileSection from './CompanyProfileSection'

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

type Props = { session: SessionUser; profile: BusinessProfile | null }

export default function OwnerProfileView({ session, profile }: Props) {
  const ownerName =
    session.fullName ||
    [session.firstName, session.lastName].filter(Boolean).join(' ') ||
    session.name ||
    'Business Owner'

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-prominent-purple-700">My Profile</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">Business Owner</h1>
      </div>

      <div className="space-y-4">
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

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={ownerName} />
            <Field label="Email" value={session.email} />
            <Field label="Role" value="Business Owner" />
            <Field label="Account status" value={titleCase(session.status)} />
          </div>
        </section>

        <CompanyProfileSection profile={profile} />
      </div>
    </main>
  )
}
