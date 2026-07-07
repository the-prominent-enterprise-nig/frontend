'use client'

import { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Upload,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Store,
} from 'lucide-react'
import {
  getBranchReceiptConfig,
  updateBranchReceiptConfig,
  uploadBranchReceiptLogo,
} from '../../_actions/branch-receipt-config'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import type { BranchReceiptConfig } from '@/src/schema/pos'

const HEADER_MAX_LENGTH = 200
const FOOTER_MAX_LENGTH = 500
const FOOTER_TOKENS = [
  { token: '{{branch_name}}', label: 'Branch name' },
  { token: '{{date}}', label: 'Date' },
]
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_LOGO_BYTES = 2 * 1024 * 1024

function resolveFooterTokens(template: string, branchName: string) {
  const today = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
  return template.replace(/{{\s*branch_name\s*}}/g, branchName).replace(/{{\s*date\s*}}/g, today)
}

function validateLogoFile(file: File): string | null {
  if (file.size > MAX_LOGO_BYTES) return 'Logo must be under 2 MB.'
  if (!ALLOWED_MIME.includes(file.type)) return 'Logo must be PNG, JPG, or SVG.'
  return null
}

interface Props {
  isBranchManager: boolean
  ownBranch: { id: string; name: string } | null
}

export default function ReceiptBrandingClient({ isBranchManager, ownBranch }: Props) {
  const { branchId: contextBranchId, branchName: contextBranchName } = usePosBranchContext()

  const branchId = isBranchManager ? (ownBranch?.id ?? null) : contextBranchId
  const branchName = isBranchManager ? (ownBranch?.name ?? null) : contextBranchName

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function showError(message: string) {
    setError(message)
    setSuccess('')
  }
  function showSuccess(message: string) {
    setSuccess(message)
    setError('')
    setTimeout(() => setSuccess(''), 3000)
  }

  const [effective, setEffective] = useState<BranchReceiptConfig | null>(null)
  const [loadingEffective, setLoadingEffective] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [headerText, setHeaderText] = useState('')
  const [footerText, setFooterText] = useState('')
  const footerRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function refreshEffective(id: string) {
    setLoadingEffective(true)
    getBranchReceiptConfig(id).then((res) => {
      setEffective(res.success ? (res.data?.data ?? null) : null)
      setLoadingEffective(false)
    })
  }

  useEffect(() => {
    if (!branchId) {
      setEffective(null)
      return
    }
    setEditing(false)
    refreshEffective(branchId)
  }, [branchId])

  function handleEdit() {
    setError('')
    setHeaderText(effective?.overrides.headerText ? (effective.headerText ?? '') : '')
    setFooterText(effective?.overrides.footerText ? (effective.footerText ?? '') : '')
    setEditing(true)
  }

  function handleCancel() {
    setEditing(false)
  }

  function insertFooterToken(token: string) {
    const el = footerRef.current
    if (!el) {
      setFooterText((prev) => (prev + token).slice(0, FOOTER_MAX_LENGTH))
      return
    }
    const start = el.selectionStart ?? footerText.length
    const end = el.selectionEnd ?? footerText.length
    const next = footerText.slice(0, start) + token + footerText.slice(end)
    setFooterText(next.slice(0, FOOTER_MAX_LENGTH))
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + token.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  async function handleLogoUpload(file: File) {
    if (!branchId) return
    const validationError = validateLogoFile(file)
    if (validationError) return showError(validationError)

    setUploadingLogo(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadBranchReceiptLogo(branchId, fd)
    setUploadingLogo(false)

    if (!res.success) return showError(res.error ?? 'Upload failed.')
    refreshEffective(branchId)
  }

  async function handleResetLogo() {
    if (!branchId) return
    setSaving(true)
    const res = await updateBranchReceiptConfig(branchId, { logoUrl: null })
    setSaving(false)
    if (!res.success) return showError(res.error ?? 'Failed to reset logo.')
    setEffective(res.data?.data ?? null)
  }

  async function handleSave() {
    if (!branchId) return
    setSaving(true)
    const res = await updateBranchReceiptConfig(branchId, {
      headerText: headerText.trim() ? headerText : null,
      footerText: footerText.trim() ? footerText : null,
    })
    setSaving(false)
    if (!res.success) return showError(res.error ?? 'Failed to save branch override.')

    setEffective(res.data?.data ?? null)
    setEditing(false)
    showSuccess(`Receipt branding saved for ${branchName ?? 'branch'}.`)
  }

  if (!branchId) {
    return (
      <div className="min-h-full bg-zinc-50 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Receipt Branding</h1>
              <p className="text-sm text-gray-500">Override the company default for a branch.</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
            <Store size={28} className="text-gray-300" />
            <p className="text-sm text-gray-500">
              Pick a specific branch from the switcher at the top of the page to view or edit its
              receipt override.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const displayedHeader = editing ? headerText : (effective?.headerText ?? '')
  const displayedFooter = editing ? footerText : (effective?.footerText ?? '')
  const previewHeaderLines = displayedHeader.split('\n').filter(Boolean)
  const previewFooter = displayedFooter
    ? resolveFooterTokens(displayedFooter, branchName ?? 'Your Business')
    : 'Thank you for your purchase!'
  const previewLogo = effective?.logoUrl

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <FileText size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Receipt Branding</h1>
            <p className="text-sm text-gray-500">
              Overriding the company default for <span className="font-semibold">{branchName}</span>
              .
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 size={14} />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <Store size={14} />
                Branch Override
              </div>
              {!editing && (
                <button
                  onClick={handleEdit}
                  disabled={loadingEffective}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Pencil size={12} />
                  Edit
                </button>
              )}
            </div>

            {loadingEffective || !effective ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-purple-500" />
              </div>
            ) : editing ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Branch Logo</p>
                    {effective.overrides.logoUrl && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {effective.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={effective.logoUrl}
                        alt="Branch logo"
                        className="h-14 w-auto max-w-35 rounded-lg border border-gray-100 object-contain p-1"
                      />
                    ) : (
                      <p className="text-sm text-gray-400">Using company default (none set)</p>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Upload size={12} />
                      )}
                      {effective.overrides.logoUrl ? 'Replace' : 'Upload custom logo'}
                    </button>
                    {effective.overrides.logoUrl && (
                      <button
                        onClick={handleResetLogo}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RotateCcw size={12} />
                        Use default
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleLogoUpload(file)
                      e.target.value = ''
                    }}
                  />
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Header Text</p>
                    {effective.overrides.headerText && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-gray-500">
                    Leave blank to use the company default.
                  </p>
                  <textarea
                    value={headerText}
                    maxLength={HEADER_MAX_LENGTH}
                    rows={2}
                    placeholder={effective.overrides.headerText ? '' : (effective.headerText ?? '')}
                    onChange={(e) => setHeaderText(e.target.value)}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
                  />
                  <p className="mt-1 text-right text-[10px] text-gray-400">
                    {headerText.length}/{HEADER_MAX_LENGTH}
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Footer Text</p>
                    {effective.overrides.footerText && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-gray-500">
                    Leave blank to use the company default.
                  </p>
                  <textarea
                    ref={footerRef}
                    value={footerText}
                    maxLength={FOOTER_MAX_LENGTH}
                    rows={3}
                    placeholder={effective.overrides.footerText ? '' : (effective.footerText ?? '')}
                    onChange={(e) => setFooterText(e.target.value)}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {FOOTER_TOKENS.map((t) => (
                        <button
                          key={t.token}
                          type="button"
                          onClick={() => insertFooterToken(t.token)}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200"
                        >
                          {t.token}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {footerText.length}/{FOOTER_MAX_LENGTH}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Logo
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${effective.overrides.logoUrl ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {effective.overrides.logoUrl ? 'Custom' : 'Using default'}
                  </span>
                </div>
                {effective.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={effective.logoUrl}
                    alt="Effective logo"
                    className="h-12 w-auto max-w-35 rounded-lg border border-gray-100 object-contain p-1"
                  />
                ) : (
                  <p className="text-sm text-gray-400">No logo set</p>
                )}

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Header Text
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${effective.overrides.headerText ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {effective.overrides.headerText ? 'Custom' : 'Using default'}
                  </span>
                </div>
                {effective.headerText ? (
                  <p className="whitespace-pre-line text-sm text-gray-700">
                    {effective.headerText}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">No header text set</p>
                )}

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Footer Text
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${effective.overrides.footerText ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {effective.overrides.footerText ? 'Custom' : 'Using default'}
                  </span>
                </div>
                {effective.footerText ? (
                  <p className="whitespace-pre-line text-sm text-gray-700">
                    {effective.footerText}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">No footer text set</p>
                )}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Preview — {branchName}
            </p>
            <div className="mx-auto w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col items-center gap-2 border-b border-gray-100 px-4 py-5">
                {previewLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewLogo}
                    alt="logo"
                    className="h-10 w-auto max-w-30 object-contain"
                  />
                ) : (
                  <span className="text-sm font-bold tracking-wide text-gray-800">
                    Your Business
                  </span>
                )}
                {previewHeaderLines.length > 0 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    {previewHeaderLines.map((line, i) => (
                      <span key={i} className="text-[10px] text-gray-500">
                        {line}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-300">Header text</span>
                )}
              </div>

              <div className="space-y-1 px-4 py-3 text-[10px] text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-400">Date</span>
                  <span>Jun 26, 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">TXN #</span>
                  <span>POS-001</span>
                </div>
                <div className="my-2 border-t border-gray-100" />
                <div className="flex justify-between">
                  <span>Item A × 2</span>
                  <span>₱200.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Item B × 1</span>
                  <span>₱150.00</span>
                </div>
                <div className="my-2 border-t border-gray-100" />
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>Total</span>
                  <span>₱350.00</span>
                </div>
                <p className="mt-3 whitespace-pre-line text-center text-[9px] text-gray-400">
                  {previewFooter}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
