'use client'

import { useState, useMemo } from 'react'
import {
  usePaymentMethods,
  useUpdatePaymentMethod,
  useCreateCustomPaymentMethod,
  useDeletePaymentMethod,
  useReorderPaymentMethods,
} from '../_hooks/usePos'
import { getGLAccounts, type GLAccount } from '../_actions/pos-actions'
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
} from 'lucide-react'
import type { PaymentMethodConfig, CreateCustomPaymentMethodInput } from '@/src/schema/pos'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
        checked ? 'bg-purple-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentMethodsPage() {
  const { data, isLoading, isFetching, refetch } = usePaymentMethods()
  const updateMutation = useUpdatePaymentMethod()
  const deleteMutation = useDeletePaymentMethod()
  const reorderMutation = useReorderPaymentMethods()

  const serverMethods: PaymentMethodConfig[] = useMemo(
    () => [...(data?.data?.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [data]
  )

  // Local ordered copy for reorder dirty-tracking
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null)
  const displayMethods =
    orderedIds != null
      ? orderedIds.map((id) => serverMethods.find((m) => m.id === id)!).filter(Boolean)
      : serverMethods

  const isOrderDirty = orderedIds != null

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // GL accounts (loaded lazily)
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([])
  const [glLoaded, setGlLoaded] = useState(false)
  async function ensureGlAccounts() {
    if (glLoaded) return
    const res = await getGLAccounts()
    if (res.success) setGlAccounts(res.data ?? [])
    setGlLoaded(true)
  }

  // Edit panel
  const [editTarget, setEditTarget] = useState<PaymentMethodConfig | null>(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodConfig | null>(null)

  // ─── Reorder helpers ──────────────────────────────────────────────────────

  function move(id: string, dir: -1 | 1) {
    const ids = (orderedIds ?? serverMethods.map((m) => m.id)).slice()
    const idx = ids.indexOf(id)
    const next = idx + dir
    if (next < 0 || next >= ids.length) return
    ;[ids[idx], ids[next]] = [ids[next], ids[idx]]
    setOrderedIds(ids)
  }

  async function handleSaveOrder() {
    if (!orderedIds) return
    const res = await reorderMutation.mutateAsync(orderedIds)
    if (!res.success) {
      showToast(res.error ?? 'Failed to save order', false)
      return
    }
    setOrderedIds(null)
    showToast('Display order saved')
  }

  // ─── Toggle ───────────────────────────────────────────────────────────────

  async function handleToggle(m: PaymentMethodConfig) {
    const res = await updateMutation.mutateAsync({ id: m.id, input: { isEnabled: !m.isEnabled } })
    if (!res.success) {
      showToast(res.error ?? 'Failed to update', false)
      return
    }
    showToast(`${m.name} ${!m.isEnabled ? 'enabled' : 'disabled'}`)
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(m: PaymentMethodConfig) {
    const res = await deleteMutation.mutateAsync(m.id)
    if (!res.success) {
      showToast(res.error ?? 'Failed to delete', false)
      return
    }
    setDeleteTarget(null)
    showToast(`${m.name} removed`)
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure which payment methods cashiers can use, their display order, and GL account
              mapping.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isOrderDirty && (
              <button
                onClick={handleSaveOrder}
                disabled={reorderMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
              >
                <Save size={14} />
                {reorderMutation.isPending ? 'Saving…' : 'Save Order'}
              </button>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => {
                ensureGlAccounts()
                setShowCreate(true)
              }}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
            >
              <Plus size={14} />
              Add Custom Method
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium ${
              toast.ok
                ? 'border border-green-200 bg-green-50 text-green-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {toast.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4">
                  <div className="h-4 w-4 rounded bg-gray-200" />
                  <div className="h-4 w-1/4 rounded bg-gray-200" />
                  <div className="h-4 w-16 rounded bg-gray-200" />
                  <div className="ml-auto h-5 w-9 rounded-full bg-gray-200" />
                </div>
              ))}
            </div>
          ) : displayMethods.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <CreditCard size={36} />
              <p className="text-sm">No payment methods configured.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="w-16 px-4 py-3 text-center text-xs font-semibold uppercase text-gray-400">
                    Order
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    GL Account
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayMethods.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    {/* Order controls */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => move(m.id, -1)}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          onClick={() => move(m.id, 1)}
                          disabled={idx === displayMethods.length - 1}
                          className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{m.name}</p>
                        {m.label && m.label !== m.name && (
                          <p className="text-xs text-gray-400">Label: {m.label}</p>
                        )}
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.type === 'custom'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>

                    {/* GL Account */}
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {m.glAccountId ? (
                        <span className="font-medium text-gray-700">{m.glAccountId}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Toggle */}
                    <td className="px-5 py-3">
                      <Toggle
                        checked={m.isEnabled}
                        onChange={() => handleToggle(m)}
                        disabled={updateMutation.isPending}
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            ensureGlAccounts()
                            setEditTarget(m)
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        {m.type === 'custom' && (
                          <button
                            onClick={() => setDeleteTarget(m)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {isOrderDirty && (
          <p className="text-xs text-amber-600 font-medium">
            Order changed — click &ldquo;Save Order&rdquo; to persist.
          </p>
        )}
      </div>

      {/* Edit Panel */}
      {editTarget && (
        <EditModal
          method={editTarget}
          glAccounts={glAccounts}
          onClose={() => setEditTarget(null)}
          onSaved={(msg) => {
            setEditTarget(null)
            showToast(msg)
          }}
          onError={(msg) => showToast(msg, false)}
        />
      )}

      {/* Create Form */}
      {showCreate && (
        <CreateModal
          glAccounts={glAccounts}
          onClose={() => setShowCreate(false)}
          onCreated={(msg) => {
            setShowCreate(false)
            showToast(msg)
          }}
          onError={(msg) => showToast(msg, false)}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDeleteModal
          method={deleteTarget}
          isLoading={deleteMutation.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  method,
  glAccounts,
  onClose,
  onSaved,
  onError,
}: {
  method: PaymentMethodConfig
  glAccounts: GLAccount[]
  onClose: () => void
  onSaved: (msg: string) => void
  onError: (msg: string) => void
}) {
  const updateMutation = useUpdatePaymentMethod()
  const [name, setName] = useState(method.name)
  const [glAccountId, setGlAccountId] = useState(method.glAccountId ?? '')

  async function handleSave() {
    const input: Partial<{ name: string; glAccountId: string | null }> = {
      glAccountId: glAccountId || null,
    }
    if (method.type === 'custom') input.name = name.trim()

    const res = await updateMutation.mutateAsync({ id: method.id, input })
    if (!res.success) {
      onError(res.error ?? 'Failed to save')
      return
    }
    onSaved(`${method.name} updated`)
  }

  const sortedAccounts = [...(glAccounts ?? [])].sort((a, b) =>
    (a.number ?? a.code ?? '').localeCompare(b.number ?? b.code ?? '')
  )

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-1 text-lg font-bold text-gray-900">Edit Payment Method</h2>
      <p className="mb-5 text-xs text-gray-400">
        {method.type === 'custom' ? 'Custom' : 'Standard'} · Key: {method.key ?? 'custom'}
      </p>

      <div className="space-y-4">
        <Field label="Name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={method.type === 'standard'}
            placeholder={method.name}
          />
          {method.type === 'standard' && (
            <p className="mt-1 text-xs text-gray-400">Standard method names cannot be changed.</p>
          )}
        </Field>

        <Field label="GL Account (Debit)">
          <div className="relative">
            <select
              className="select"
              value={glAccountId}
              onChange={(e) => setGlAccountId(e.target.value)}
            >
              <option value="">— Not mapped —</option>
              {sortedAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number ?? a.code} · {a.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button onClick={handleSave} disabled={updateMutation.isPending} className="btn-primary">
          {updateMutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Overlay>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  glAccounts,
  onClose,
  onCreated,
  onError,
}: {
  glAccounts: GLAccount[]
  onClose: () => void
  onCreated: (msg: string) => void
  onError: (msg: string) => void
}) {
  const createMutation = useCreateCustomPaymentMethod()

  const [form, setForm] = useState<CreateCustomPaymentMethodInput>({
    name: '',
    label: '',
    referenceFieldLabel: '',
    referenceFieldRegex: '',
    referenceIsRequired: false,
    glAccountId: '',
  })
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CreateCustomPaymentMethodInput, string>>
  >({})
  const [regexTest, setRegexTest] = useState('')
  const [regexResult, setRegexResult] = useState<boolean | null>(null)

  function set<K extends keyof CreateCustomPaymentMethodInput>(
    k: K,
    v: CreateCustomPaymentMethodInput[K]
  ) {
    setForm((p) => ({ ...p, [k]: v }))
    setFieldErrors((p) => ({ ...p, [k]: undefined }))
  }

  function testRegex() {
    if (!form.referenceFieldRegex?.trim()) return
    try {
      const re = new RegExp(form.referenceFieldRegex.trim())
      setRegexResult(re.test(regexTest))
    } catch {
      setFieldErrors((p) => ({ ...p, referenceFieldRegex: 'Invalid regular expression' }))
      setRegexResult(null)
    }
  }

  async function handleCreate() {
    const errors: typeof fieldErrors = {}
    if (!form.name.trim()) errors.name = 'Name is required'
    if (!form.label.trim()) errors.label = 'Label is required'
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }

    const input: CreateCustomPaymentMethodInput = {
      name: form.name.trim(),
      label: form.label.trim(),
      ...(form.referenceFieldLabel?.trim()
        ? { referenceFieldLabel: form.referenceFieldLabel.trim() }
        : {}),
      ...(form.referenceFieldRegex?.trim()
        ? { referenceFieldRegex: form.referenceFieldRegex.trim() }
        : {}),
      referenceIsRequired: form.referenceIsRequired,
      ...(form.glAccountId ? { glAccountId: form.glAccountId } : {}),
    }

    const res = await createMutation.mutateAsync(input)
    if (!res.success) {
      if (
        res.error?.includes('DUPLICATE_METHOD_NAME') ||
        res.error?.toLowerCase().includes('already exists')
      ) {
        setFieldErrors({ name: 'Name already exists' })
      } else if (res.error?.includes('INVALID_REGEX')) {
        setFieldErrors({ referenceFieldRegex: 'Invalid regular expression' })
      } else {
        onError(res.error ?? 'Failed to create')
      }
      return
    }
    onCreated(`${form.name} created`)
  }

  const sortedAccounts = [...(glAccounts ?? [])].sort((a, b) =>
    (a.number ?? a.code ?? '').localeCompare(b.number ?? b.code ?? '')
  )

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-5 text-lg font-bold text-gray-900">Add Custom Payment Method</h2>

      <div className="space-y-4">
        <Field label="Name *">
          <input
            className={`input ${fieldErrors.name ? 'border-red-300' : ''}`}
            placeholder="e.g. Company Charge Account"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
        </Field>

        <Field label="Label * (short, shown on cashier button)">
          <input
            className={`input ${fieldErrors.label ? 'border-red-300' : ''}`}
            placeholder="e.g. Charge"
            maxLength={10}
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
          />
          {fieldErrors.label && <p className="mt-1 text-xs text-red-600">{fieldErrors.label}</p>}
        </Field>

        <Field label="Reference Field Label (optional)">
          <input
            className="input"
            placeholder="e.g. Voucher Code"
            value={form.referenceFieldLabel}
            onChange={(e) => set('referenceFieldLabel', e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-400">Shown above the reference input at checkout.</p>
        </Field>

        <Field label="Validation Regex (optional)">
          <input
            className={`input font-mono text-xs ${fieldErrors.referenceFieldRegex ? 'border-red-300' : ''}`}
            placeholder={`e.g. ^VCH-\\d{6}$`}
            value={form.referenceFieldRegex}
            onChange={(e) => {
              set('referenceFieldRegex', e.target.value)
              setRegexResult(null)
            }}
          />
          {fieldErrors.referenceFieldRegex && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.referenceFieldRegex}</p>
          )}
          {form.referenceFieldRegex?.trim() && (
            <div className="mt-2 flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-purple-400"
                placeholder="Test a value…"
                value={regexTest}
                onChange={(e) => {
                  setRegexTest(e.target.value)
                  setRegexResult(null)
                }}
              />
              <button
                onClick={testRegex}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Test
              </button>
              {regexResult !== null && (
                <span
                  className={`text-xs font-semibold ${regexResult ? 'text-green-600' : 'text-red-600'}`}
                >
                  {regexResult ? '✓ Match' : '✗ No match'}
                </span>
              )}
            </div>
          )}
        </Field>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="refRequired"
            checked={!!form.referenceIsRequired}
            onChange={(e) => set('referenceIsRequired', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="refRequired" className="text-sm text-gray-700">
            Reference is required at checkout
          </label>
        </div>

        <Field label="GL Account (optional)">
          <div className="relative">
            <select
              className="select"
              value={form.glAccountId}
              onChange={(e) => set('glAccountId', e.target.value)}
            >
              <option value="">— Not mapped —</option>
              {sortedAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number ?? a.code} · {a.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button onClick={handleCreate} disabled={createMutation.isPending} className="btn-primary">
          {createMutation.isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </Overlay>
  )
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  method,
  isLoading,
  onClose,
  onConfirm,
}: {
  method: PaymentMethodConfig
  isLoading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-2 text-lg font-bold text-gray-900">Remove Payment Method</h2>
      <p className="mb-5 text-sm text-gray-600">
        Remove <span className="font-semibold">{method.name}</span>? This cannot be undone. Existing
        transactions using this method are unaffected.
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </Overlay>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          {children}
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}
