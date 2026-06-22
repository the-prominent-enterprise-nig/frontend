'use client'

import {
  X,
  Shield,
  Building2,
  UserCog,
  Pencil,
  Trash2,
  Mail,
  Calendar,
  Hash,
  User as UserIcon,
  Power,
  Phone,
  Heart,
  Briefcase,
} from 'lucide-react'
import { type User } from '@/src/schema/settings/list'

type UserDetailDrawerProps = {
  user: User | null
  onClose: () => void
  onEdit: (user: User) => void
  onAssignRole: (user: User) => void
  onToggleActive: (user: User) => void
  onDelete: (user: User) => void
  isSelf: boolean
}

export default function UserDetailDrawer({
  user,
  onClose,
  onEdit,
  onAssignRole,
  onToggleActive,
  onDelete,
  isSelf,
}: UserDetailDrawerProps) {
  if (!user) return null

  const displayName =
    user.name?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    (user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : null) ||
    'Unknown User'

  const branches = user.userBranches.map((ub) => ub.branch.name)
  const roles = user.userRoles.map((ur) => ur.role)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prominent-purple-100 text-prominent-purple-700 font-semibold text-base">
              {(displayName[0] ?? '?').toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold text-zinc-900">{displayName}</h2>
                {isSelf && (
                  <span className="shrink-0 rounded-full bg-prominent-purple-100 px-2 py-0.5 text-xs font-medium text-prominent-purple-700">
                    You
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-zinc-500">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Status + dates */}
          <Section title="Account">
            <Field icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
            <Field
              icon={
                <div
                  className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-zinc-400'}`}
                />
              }
              label="Status"
              value={
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    user.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              }
            />
            <Field
              icon={<Calendar className="h-4 w-4" />}
              label="Created"
              value={new Date(user.createdAt).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
            <Field
              icon={<Calendar className="h-4 w-4" />}
              label="Last updated"
              value={new Date(user.updatedAt).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          </Section>

          {/* Linked employee */}
          {user.employee && (
            <Section title="Employee Profile">
              <Field
                icon={<Hash className="h-4 w-4" />}
                label="Employee Code"
                value={
                  <span className="font-mono text-zinc-700">{user.employee.employeeCode}</span>
                }
              />
              <Field
                icon={<UserIcon className="h-4 w-4" />}
                label="Full Name"
                value={[
                  user.employee.firstName,
                  user.employee.middleName ?? undefined,
                  user.employee.lastName,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              {user.employee.contactNumber && (
                <Field
                  icon={<Phone className="h-4 w-4" />}
                  label="Contact"
                  value={user.employee.contactNumber}
                />
              )}
              {user.employee.dateOfBirth && (
                <Field
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date of Birth"
                  value={new Date(user.employee.dateOfBirth).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
              )}
              {user.employee.maritalStatus && (
                <Field
                  icon={<Heart className="h-4 w-4" />}
                  label="Marital Status"
                  value={user.employee.maritalStatus}
                />
              )}
              {user.employee.hireDate && (
                <Field
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Hire Date"
                  value={new Date(user.employee.hireDate).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
              )}
            </Section>
          )}

          {/* Branches */}
          <Section title="Branch Access">
            {branches.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Building2 className="h-4 w-4 text-zinc-400" />
                <span>Head Office (all branches)</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <span
                    key={b}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
                  >
                    <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                    {b}
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* Roles */}
          <Section title={`Roles${roles.length > 0 ? ` (${roles.length})` : ''}`}>
            {roles.length === 0 ? (
              <p className="text-sm text-zinc-500">No roles assigned.</p>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => (
                  <div key={role.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-prominent-purple-600" />
                      <span className="text-sm font-semibold text-zinc-900">{role.name}</span>
                    </div>
                    {role.description && (
                      <p className="mt-1 pl-6 text-xs text-zinc-500">{role.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Footer actions */}
        {!isSelf && (
          <div className="border-t border-zinc-200 px-6 py-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEdit(user)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onAssignRole(user)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <UserCog className="h-4 w-4" />
              Assign Role
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(user)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <Power className="h-4 w-4" />
              {user.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(user)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex items-center gap-2 text-zinc-500 shrink-0">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-sm text-zinc-800 text-right">{value}</div>
    </div>
  )
}
