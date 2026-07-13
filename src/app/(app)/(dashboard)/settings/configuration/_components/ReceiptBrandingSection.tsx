'use client'

import { useState, useRef } from 'react'
import { Building2, Upload, X, Save, Loader2 } from 'lucide-react'
import {
  uploadReceiptLogo,
  updateReceiptBranding,
  type ReceiptBranding,
} from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import {
  RECEIPT_HEADER_MAX_LENGTH,
  RECEIPT_FOOTER_MAX_LENGTH,
  RECEIPT_FOOTER_TOKENS,
  validateReceiptLogoFile,
  resolveReceiptFooterTokens,
} from '@/src/libs/pos/receipt-branding'
import { ReceiptBrandingCardShell } from '@/src/components/pos/ReceiptBrandingCardShell'
import { ReceiptFieldRow } from '@/src/components/pos/ReceiptFieldRow'
import { ReceiptTextEditField } from '@/src/components/pos/ReceiptTextEditField'
import { ReceiptPreviewPanel } from '@/src/components/pos/ReceiptPreviewPanel'

export function ReceiptBrandingSection({ initialBranding }: { initialBranding: ReceiptBranding }) {
  const [branding, setBranding] = useState<ReceiptBranding>(initialBranding)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [headerText, setHeaderText] = useState(initialBranding.receiptHeaderText ?? '')
  const [footerText, setFooterText] = useState(initialBranding.receiptFooterText ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showSuccess() {
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  function handleEdit() {
    setError('')
    setEditing(true)
  }

  function handleCancel() {
    setHeaderText(branding.receiptHeaderText ?? '')
    setFooterText(branding.receiptFooterText ?? '')
    setError('')
    setEditing(false)
  }

  async function handleLogoUpload(file: File) {
    const validationError = validateReceiptLogoFile(file)
    if (validationError) return setError(validationError)

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadReceiptLogo(fd)
    setUploading(false)

    if (!res.success || !res.data) return setError(res.error ?? 'Upload failed.')
    setBranding((b) => ({ ...b, receiptLogoUrl: res.data!.logoUrl }))
  }

  async function handleRemoveLogo() {
    setSaving(true)
    const res = await updateReceiptBranding({ logoUrl: null })
    setSaving(false)
    if (!res.success) return setError(res.error ?? 'Failed to remove logo.')
    setBranding((b) => ({ ...b, receiptLogoUrl: null }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await updateReceiptBranding({
      headerText: headerText || undefined,
      footerText: footerText.trim() ? footerText : null,
    })
    setSaving(false)
    if (!res.success) return setError(res.error ?? 'Failed to save branding.')

    if (res.data) {
      setBranding(res.data)
      setHeaderText(res.data.receiptHeaderText ?? '')
      setFooterText(res.data.receiptFooterText ?? '')
    }
    setEditing(false)
    showSuccess()
  }

  const displayedHeader = editing ? headerText : (branding.receiptHeaderText ?? '')
  const displayedFooter = editing ? footerText : (branding.receiptFooterText ?? '')
  const previewFooter = displayedFooter
    ? resolveReceiptFooterTokens(displayedFooter, 'Your Business')
    : ''

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        This is the company-wide default logo, header, and footer used on every branch&apos;s
        receipts. A branch can override any of these just for itself under its own settings.
      </p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Receipt branding saved.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReceiptBrandingCardShell
          icon={Building2}
          label="Company Default"
          editing={editing}
          onEdit={handleEdit}
        >
          {editing ? (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-700">Business Logo</p>
                <p className="mb-3 text-xs text-gray-500">PNG, JPG, or SVG — max 2 MB</p>
                <div className="flex items-center gap-3">
                  {branding.receiptLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={branding.receiptLogoUrl}
                      alt="Receipt logo"
                      className="h-14 w-auto max-w-35 rounded-lg border border-gray-100 object-contain p-1"
                    />
                  ) : (
                    <p className="text-sm text-gray-400">No logo set</p>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    {branding.receiptLogoUrl ? 'Replace' : 'Upload logo'}
                  </button>
                  {branding.receiptLogoUrl && (
                    <button
                      onClick={handleRemoveLogo}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <X size={12} />
                      Remove
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
                helperText="Each line appears separately below the logo."
                value={headerText}
                onChange={setHeaderText}
                maxLength={RECEIPT_HEADER_MAX_LENGTH}
                rows={3}
                placeholder={'SM City\nIloilo City'}
              />

              <ReceiptTextEditField
                label="Footer Text"
                helperText="Shown at the bottom of every branch's receipts unless that branch sets its own."
                value={footerText}
                onChange={setFooterText}
                maxLength={RECEIPT_FOOTER_MAX_LENGTH}
                rows={3}
                placeholder="Thank you for shopping with us!"
                tokens={RECEIPT_FOOTER_TOKENS}
                onInsertToken={(token) =>
                  setFooterText((prev) => (prev + token).slice(0, RECEIPT_FOOTER_MAX_LENGTH))
                }
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
              <ReceiptFieldRow label="Logo" divider={false}>
                {branding.receiptLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={branding.receiptLogoUrl}
                    alt="Receipt logo"
                    className="h-12 w-auto max-w-35 rounded-lg border border-gray-100 object-contain p-1"
                  />
                ) : (
                  <p className="text-sm text-gray-400">No logo set</p>
                )}
              </ReceiptFieldRow>

              <ReceiptFieldRow label="Header Text">
                {branding.receiptHeaderText ? (
                  <p className="whitespace-pre-line text-sm text-gray-700">
                    {branding.receiptHeaderText}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">No header text set</p>
                )}
              </ReceiptFieldRow>

              <ReceiptFieldRow label="Footer Text">
                {branding.receiptFooterText ? (
                  <p className="whitespace-pre-line text-sm text-gray-700">
                    {branding.receiptFooterText}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">No footer text set</p>
                )}
              </ReceiptFieldRow>
            </div>
          )}
        </ReceiptBrandingCardShell>

        <ReceiptPreviewPanel
          title="Preview — Company Default"
          logoUrl={branding.receiptLogoUrl}
          headerText={displayedHeader}
          footerText={previewFooter}
        />
      </div>
    </div>
  )
}
