import { Mail, ShieldCheck, UserRound } from 'lucide-react'
import { type SessionUser } from '@/src/libs/guards/permission'
import { type BusinessProfile } from '@/src/libs/actions/enterprise.actions'
import CompanyProfileSection from './CompanyProfileSection'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'BO'
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value?: string | null
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-zinc-50 px-4 py-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-prominent-purple-700 shadow-sm ring-1 ring-zinc-200">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-zinc-900">{value || '—'}</p>
      </div>
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
    <main className="w-full space-y-6 px-4 py-8 sm:px-6 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-prominent-purple-900 via-prominent-purple-800 to-prominent-purple-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl font-semibold ring-1 ring-white/30 backdrop-blur">
              {initials(ownerName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/70">My Profile</p>
              <h1 className="mt-0.5 truncate text-3xl font-semibold tracking-tight">{ownerName}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Business Owner
                </span>
              </div>
            </div>
          </div>
          {profile?.companyTradingName && (
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Company
              </p>
              <p className="mt-1 text-2xl font-semibold">{profile.companyTradingName}</p>
              {profile.companyLegalName && (
                <p className="text-sm text-white/70">{profile.companyLegalName}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-prominent-purple-50 text-prominent-purple-700">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-prominent-purple-900">
                Account Information
              </h2>
              <p className="text-sm text-zinc-500">Owner login and access details</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <DetailRow icon={UserRound} label="Name" value={ownerName} />
            <DetailRow icon={Mail} label="Email" value={session.email} />
            <DetailRow icon={ShieldCheck} label="Role" value="Business Owner" />
          </div>
        </section>

        <div className="xl:col-span-2">
          <CompanyProfileSection profile={profile} />
        </div>
      </div>
    </main>
  )
}
