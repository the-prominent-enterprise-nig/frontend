'use client'

import { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Upload,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Store,
} from 'lucide-react'
import {
  getBranchReceiptConfig,
  updateBranchReceiptConfig,
  uploadBranchReceiptLogo,
} from '../../../_actions/branch-receipt-config'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import type { BranchReceiptConfig } from '@/src/schema/pos'
import {
  RECEIPT_HEADER_MAX_LENGTH,
  RECEIPT_FOOTER_MAX_LENGTH,
  RECEIPT_FOOTER_TOKENS,
  validateReceiptLogoFile,
  resolveReceiptFooterTokens,
} from '@/src/libs/pos/receipt-branding'
import { ReceiptBrandingCardShell } from '@/src/components/pos/ReceiptBrandingCardShell'
import { ReceiptOverrideBadge } from '@/src/components/pos/ReceiptOverrideBadge'
import { ReceiptFieldRow } from '@/src/components/pos/ReceiptFieldRow'
import { ReceiptTextEditField } from '@/src/components/pos/ReceiptTextEditField'
import { ReceiptPreviewPanel } from '@/src/components/pos/ReceiptPreviewPanel'

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
      setFooterText((prev) => (prev + token).slice(0, RECEIPT_FOOTER_MAX_LENGTH))
      return
    }
    const start = el.selectionStart ?? footerText.length
    const end = el.selectionEnd ?? footerText.length
    const next = footerText.slice(0, start) + token + footerText.slice(end)
    setFooterText(next.slice(0, RECEIPT_FOOTER_MAX_LENGTH))
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + token.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  async function handleLogoUpload(file: File) {
    if (!branchId) return
    const validationError = validateReceiptLogoFile(file)
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
  const previewFooter = displayedFooter
    ? resolveReceiptFooterTokens(displayedFooter, branchName ?? 'Your Business')
    : 'Thank you for your purchase!'
  const previewLogo = effective?.logoUrl ?? null

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
          <ReceiptBrandingCardShell
            icon={Store}
            label="Branch Override"
            editing={editing}
            loading={loadingEffective || !effective}
            onEdit={handleEdit}
          >
            {effective &&
              (editing ? (
                <div className="space-y-5">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Branch Logo</p>
                      {effective.overrides.logoUrl && <ReceiptOverrideBadge overridden />}
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

                  <ReceiptTextEditField
                    label="Header Text"
                    helperText="Leave blank to use the company default."
                    value={headerText}
                    onChange={setHeaderText}
                    maxLength={RECEIPT_HEADER_MAX_LENGTH}
                    rows={2}
                    placeholder={effective.overrides.headerText ? '' : (effective.headerText ?? '')}
                    badge={effective.overrides.headerText && <ReceiptOverrideBadge overridden />}
                  />

                  <ReceiptTextEditField
                    label="Footer Text"
                    helperText="Leave blank to use the company default."
                    value={footerText}
                    onChange={setFooterText}
                    maxLength={RECEIPT_FOOTER_MAX_LENGTH}
                    rows={3}
                    placeholder={effective.overrides.footerText ? '' : (effective.footerText ?? '')}
                    badge={effective.overrides.footerText && <ReceiptOverrideBadge overridden />}
                    tokens={RECEIPT_FOOTER_TOKENS}
                    onInsertToken={insertFooterToken}
                    textareaRef={footerRef}
                  />

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
                  <ReceiptFieldRow
                    label="Logo"
                    divider={false}
                    badge={<ReceiptOverrideBadge overridden={effective.overrides.logoUrl} />}
                  >
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
                  </ReceiptFieldRow>

                  <ReceiptFieldRow
                    label="Header Text"
                    badge={<ReceiptOverrideBadge overridden={effective.overrides.headerText} />}
                  >
                    {effective.headerText ? (
                      <p className="whitespace-pre-line text-sm text-gray-700">
                        {effective.headerText}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">No header text set</p>
                    )}
                  </ReceiptFieldRow>

                  <ReceiptFieldRow
                    label="Footer Text"
                    badge={<ReceiptOverrideBadge overridden={effective.overrides.footerText} />}
                  >
                    {effective.footerText ? (
                      <p className="whitespace-pre-line text-sm text-gray-700">
                        {effective.footerText}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">No footer text set</p>
                    )}
                  </ReceiptFieldRow>
                </div>
              ))}
          </ReceiptBrandingCardShell>

          <ReceiptPreviewPanel
            title={`Preview — ${branchName}`}
            logoUrl={previewLogo}
            headerText={displayedHeader}
            footerText={previewFooter}
          />
        </div>
      </div>
    </div>
  )
}
