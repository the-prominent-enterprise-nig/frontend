'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Pencil,
  X,
  Check,
  MapPin,
  Users,
  Calendar,
  Tag,
  Monitor,
  TrendingUp,
  Clock,
  ShoppingCart,
  UserPlus,
  Trash2,
  Building2,
  Power,
  CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import { BranchFull } from '../../../_actions/get-branch'
import { BranchSummary } from '../../../_actions/get-branch-summary'
import { updateBranch } from '../../../_actions/update-branch'
import { assignBranchManager } from '../../../_actions/assign-branch-manager'
import { removeBranchManager } from '../../../_actions/remove-branch-manager'
import { setBranchStatus } from '../../../_actions/set-branch-status'
import { BRANCH_TYPES } from '@/src/schema/settings/create-branch'
import { BranchPaymentMethod } from '@/src/schema/pos'
import { BranchPaymentMethodsSection } from '@/src/components/settings/BranchPaymentMethodsSection'
import AssignManagerModal from './AssignManagerModal'

const BRANCH_TYPE_LABELS: Record<string, string> = {
  retail: 'Retail',
  warehouse: 'Warehouse',
  office: 'Office',
  mixed: 'Mixed',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-zinc-100 text-zinc-500',
  closed: 'bg-red-100 text-red-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount)
}

type Props = {
  branch: BranchFull
  summary: BranchSummary | null
  canManageManagers?: boolean
  isBranchManager?: boolean
  initialPaymentMethods?: BranchPaymentMethod[]
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`text-3xl font-semibold ${accent ?? 'text-zinc-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

export default function BranchDetailClient({
  branch,
  summary,
  canManageManagers = false,
  isBranchManager = false,
  initialPaymentMethods = [],
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [assigningManager, setAssigningManager] = useState(false)
  const [removingManagerId, setRemovingManagerId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [confirmStatusChange, setConfirmStatusChange] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  const [name, setName] = useState(branch.name)
  const [type, setType] = useState(branch.type)
  const [address, setAddress] = useState(branch.addressLine1 ?? '')
  const [city, setCity] = useState(branch.city ?? '')

  const isDirty =
    name !== branch.name ||
    type !== branch.type ||
    address !== (branch.addressLine1 ?? '') ||
    city !== (branch.city ?? '')

  const managers = branch.managers ?? []
  const managerIds = new Set(managers.map((m) => m.id))

  const handleAssignManager = async (userId: string) => {
    setAssigningManager(true)
    const result = await assignBranchManager(branch.id, userId)
    setAssigningManager(false)
    if (!result.success) {
      toast.error(result.message || result.error || 'Failed to assign manager')
      return
    }
    toast.success('Manager added')
    setManagerModalOpen(false)
    router.refresh()
  }

  const handleRemoveManager = async (userId: string) => {
    setRemovingManagerId(userId)
    const result = await removeBranchManager(branch.id, userId)
    setRemovingManagerId(null)
    if (!result.success) {
      toast.error(result.message || result.error || 'Failed to remove manager')
      return
    }
    toast.success('Manager removed')
    setConfirmRemoveId(null)
    router.refresh()
  }

  const handleCancel = () => {
    setName(branch.name)
    setType(branch.type)
    setAddress(branch.addressLine1 ?? '')
    setCity(branch.city ?? '')
    setEditing(false)
  }

  const handleStatusChange = async () => {
    setChangingStatus(true)
    const action = branch.isActive ? 'deactivate' : 'reactivate'
    const result = await setBranchStatus(branch.id, action)
    setChangingStatus(false)
    setConfirmStatusChange(false)
    if (!result.success) {
      toast.error(result.message || result.error || `Failed to ${action} branch`)
      return
    }
    toast.success(branch.isActive ? 'Branch deactivated' : 'Branch reactivated')
    router.refresh()
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const result = await updateBranch(branch.id, {
      name: name.trim(),
      type: type as (typeof BRANCH_TYPES)[number],
      address: address.trim() || undefined,
      city: city.trim() || undefined,
    })
    setSaving(false)
    if (!result.success) {
      toast.error(result.message || result.error || 'Failed to save changes')
      return
    }
    toast.success('Branch updated')
    setEditing(false)
    router.refresh()
  }

  const hasPOS = (summary?.pos.terminals ?? 0) > 0
  const hasAlerts =
    (summary?.inventory.pendingPurchaseRequests ?? 0) > 0 ||
    (summary?.inventory.pendingPurchaseOrders ?? 0) > 0

  const addressDisplay = [branch.addressLine1, branch.city].filter(Boolean).join(', ')

  const showPaymentMethods = canManageManagers || isBranchManager

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back */}
        {canManageManagers && (
          <Link
            href="/settings/branches"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Branches
          </Link>
        )}

        {/* Header card — name + all metadata + actions */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            {/* Left: name + meta */}
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={150}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-2xl font-semibold text-zinc-900 outline-none focus:border-prominent-purple-500"
                />
              ) : (
                <h1 className="text-2xl font-semibold text-zinc-900">{name}</h1>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-zinc-400">{branch.code}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[branch.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                >
                  {branch.status}
                </span>
              </div>

              {/* Compact metadata strip */}
              {editing ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-400">Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    >
                      {BRANCH_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {BRANCH_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-400">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address"
                      maxLength={255}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-400">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      maxLength={100}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {addressDisplay && (
                    <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      {addressDisplay}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    {BRANCH_TYPE_LABELS[type] ?? type}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    {formatDate(branch.createdAt)}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    {branch.employeeCount ?? 0}{' '}
                    {(branch.employeeCount ?? 0) === 1 ? 'staff member' : 'staff members'}
                  </span>
                  {managers.length > 0 && (
                    <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                      <Users className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      {managers.length === 1
                        ? managers[0]
                          ? [managers[0].firstName, managers[0].lastName]
                              .filter(Boolean)
                              .join(' ') ||
                            managers[0].name ||
                            'Manager'
                          : '1 manager'
                        : `${managers.length} managers`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex shrink-0 items-center gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !isDirty || !name.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {canManageManagers && (
                    <button
                      type="button"
                      onClick={() => setConfirmStatusChange(true)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        branch.isActive
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-green-200 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      <Power className="h-4 w-4" />
                      {branch.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        {summary && (
          <div className="space-y-4">
            <div
              className={`grid grid-cols-2 gap-4 ${hasPOS ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}
            >
              <StatCard
                icon={Users}
                label="Total Employees"
                value={summary.employees.total}
                sub={`${summary.employees.active} active`}
                accent="text-zinc-900"
              />
              <StatCard
                icon={Users}
                label="Active Employees"
                value={summary.employees.active}
                sub={`of ${summary.employees.total} total`}
                accent="text-green-600"
              />
              {hasPOS && (
                <>
                  <StatCard
                    icon={TrendingUp}
                    label="Revenue Today"
                    value={formatCurrency(summary.pos.todayRevenue)}
                    sub={`${summary.pos.todayTransactions} transaction${summary.pos.todayTransactions !== 1 ? 's' : ''}`}
                    accent="text-prominent-purple-700"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Revenue This Month"
                    value={formatCurrency(summary.pos.monthRevenue)}
                    sub={`${summary.pos.monthTransactions} transaction${summary.pos.monthTransactions !== 1 ? 's' : ''}`}
                    accent="text-prominent-purple-700"
                  />
                </>
              )}
            </div>

            {(hasPOS || hasAlerts) && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {hasPOS && (
                  <>
                    <StatCard
                      icon={Monitor}
                      label="POS Terminals"
                      value={summary.pos.terminals}
                      sub="configured"
                    />
                    <StatCard
                      icon={Clock}
                      label="Active Sessions"
                      value={summary.pos.activeSessions}
                      sub="open right now"
                      accent={summary.pos.activeSessions > 0 ? 'text-blue-600' : 'text-zinc-900'}
                    />
                  </>
                )}
                {(summary.inventory.pendingPurchaseRequests > 0 ||
                  summary.inventory.pendingPurchaseOrders > 0 ||
                  !hasPOS) && (
                  <StatCard
                    icon={ShoppingCart}
                    label="Pending Purchases"
                    value={
                      summary.inventory.pendingPurchaseRequests +
                      summary.inventory.pendingPurchaseOrders
                    }
                    sub={
                      [
                        summary.inventory.pendingPurchaseRequests > 0 &&
                          `${summary.inventory.pendingPurchaseRequests} request${summary.inventory.pendingPurchaseRequests !== 1 ? 's' : ''}`,
                        summary.inventory.pendingPurchaseOrders > 0 &&
                          `${summary.inventory.pendingPurchaseOrders} order${summary.inventory.pendingPurchaseOrders !== 1 ? 's' : ''}`,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'none pending'
                    }
                    accent={
                      summary.inventory.pendingPurchaseRequests +
                        summary.inventory.pendingPurchaseOrders >
                      0
                        ? 'text-orange-600'
                        : 'text-zinc-900'
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Managers + Payment Methods side by side */}
        <div className={`grid grid-cols-1 gap-6 ${showPaymentMethods ? 'lg:grid-cols-2' : ''}`}>
          {/* Branch Managers */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                <Users className="h-3.5 w-3.5" />
                Branch Managers
                {managers.length > 0 && (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-600">
                    {managers.length}
                  </span>
                )}
              </div>
              {canManageManagers && (
                <button
                  type="button"
                  onClick={() => setManagerModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Manager
                </button>
              )}
            </div>

            {managers.length === 0 ? (
              <p className="text-sm italic text-zinc-400">No managers assigned yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {managers.map((m) => {
                  const fullName =
                    [m.firstName, m.lastName].filter(Boolean).join(' ') || m.name || m.email || '—'
                  const initials = (
                    [m.firstName?.[0], m.lastName?.[0]].filter(Boolean).join('') ||
                    m.name?.[0] ||
                    '?'
                  ).toUpperCase()
                  const isPrimary = m.id === branch.manager?.id
                  const isRemoving = removingManagerId === m.id

                  return (
                    <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-prominent-purple-700/10 text-sm font-semibold text-prominent-purple-700">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-zinc-900">{fullName}</p>
                          {isPrimary && (
                            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                              Primary
                            </span>
                          )}
                        </div>
                        {m.email && <p className="truncate text-xs text-zinc-500">{m.email}</p>}
                      </div>
                      {canManageManagers && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(m.id)}
                          disabled={isRemoving}
                          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                        >
                          {isRemoving ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Payment Methods */}
          {showPaymentMethods && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                <CreditCard className="h-3.5 w-3.5" />
                Payment Methods
              </div>
              <BranchPaymentMethodsSection
                branchId={branch.id}
                branchName={branch.name}
                initialMethods={initialPaymentMethods}
                readOnly={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Deactivate / Reactivate confirmation */}
      {confirmStatusChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-1 flex items-center gap-2">
              <Power className={`h-4 w-4 ${branch.isActive ? 'text-red-500' : 'text-green-600'}`} />
              <h3 className="text-sm font-semibold text-zinc-900">
                {branch.isActive ? 'Deactivate Branch' : 'Reactivate Branch'}
              </h3>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              {branch.isActive ? (
                <>
                  Deactivating <span className="font-medium">{branch.name}</span> will mark it as
                  inactive. Assigned users will retain their access but the branch will no longer
                  appear as active.
                </>
              ) : (
                <>
                  Reactivating <span className="font-medium">{branch.name}</span> will restore its
                  active status.
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmStatusChange(false)}
                disabled={changingStatus}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={changingStatus}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
                  branch.isActive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {changingStatus
                  ? branch.isActive
                    ? 'Deactivating…'
                    : 'Reactivating…'
                  : branch.isActive
                    ? 'Deactivate'
                    : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add manager modal */}
      {canManageManagers && (
        <AssignManagerModal
          isOpen={managerModalOpen}
          currentManagerIds={managerIds}
          onClose={() => setManagerModalOpen(false)}
          onAssign={handleAssignManager}
          isSubmitting={assigningManager}
        />
      )}

      {/* Remove confirmation */}
      {canManageManagers &&
        confirmRemoveId &&
        (() => {
          const target = managers.find((m) => m.id === confirmRemoveId)
          const targetName =
            [target?.firstName, target?.lastName].filter(Boolean).join(' ') ||
            target?.name ||
            'this manager'
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-1 flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-zinc-900">Remove Manager</h3>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Remove <span className="font-medium">{targetName}</span> as a branch manager?
                  Their Branch Manager role and branch access will be revoked.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(null)}
                    disabled={removingManagerId !== null}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveManager(confirmRemoveId)}
                    disabled={removingManagerId !== null}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {removingManagerId !== null ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
    </div>
  )
}
