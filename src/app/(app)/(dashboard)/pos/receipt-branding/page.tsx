'use client'

import { useState, useEffect, useRef } from 'react'
import { Palette, Upload, X, Save, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  getReceiptBranding,
  uploadReceiptLogo,
  updateReceiptBranding,
  type ReceiptBranding,
} from '../_actions/pos-actions'

const DEFAULT_PRIMARY = '#7c3aed'
const DEFAULT_ACCENT = '#a78bfa'

export default function ReceiptBrandingPage() {
  const [branding, setBranding] = useState<ReceiptBranding | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY)
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)
  const [isDirty, setIsDirty] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getReceiptBranding().then((res) => {
      setLoading(false)
      if (res.success && res.data) {
        const b = res.data
        setBranding(b)
        setLogoUrl(b.receiptLogoUrl)
        setPrimaryColor(b.receiptPrimaryColor ?? DEFAULT_PRIMARY)
        setAccentColor(b.receiptAccentColor ?? DEFAULT_ACCENT)
      }
    })
  }, [])

  function markDirty() {
    setIsDirty(true)
    setSuccess(false)
  }

  async function handleLogoUpload(file: File) {
    setError('')
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2 MB.')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      setError('Logo must be PNG, JPG, or SVG.')
      return
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadReceiptLogo(fd)
    setUploading(false)

    if (!res.success || !res.data) {
      setError(res.error ?? 'Upload failed.')
      return
    }
    setLogoUrl(res.data.logoUrl)
    markDirty()
  }

  async function handleRemoveLogo() {
    setSaving(true)
    setError('')
    const res = await updateReceiptBranding({ logoUrl: null })
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to remove logo.')
      return
    }
    setLogoUrl(null)
    setBranding((b) => (b ? { ...b, receiptLogoUrl: null } : b))
    setIsDirty(false)
    showSuccess()
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await updateReceiptBranding({
      logoUrl,
      primaryColor,
      accentColor,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to save branding.')
      return
    }
    setBranding(res.data ?? null)
    setIsDirty(false)
    showSuccess()
  }

  function handleCancel() {
    if (!branding) return
    setLogoUrl(branding.receiptLogoUrl)
    setPrimaryColor(branding.receiptPrimaryColor ?? DEFAULT_PRIMARY)
    setAccentColor(branding.receiptAccentColor ?? DEFAULT_ACCENT)
    setIsDirty(false)
    setError('')
  }

  function showSuccess() {
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Palette size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Receipt Branding</h1>
            <p className="text-sm text-gray-500">
              Upload your business logo and set brand colors on receipts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Controls */}
          <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {/* Logo upload */}
            <div>
              <p className="mb-1 text-sm font-semibold text-gray-700">Business Logo</p>
              <p className="mb-3 text-xs text-gray-500">PNG, JPG, or SVG — max 2 MB</p>

              {logoUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Receipt logo"
                    className="h-14 w-auto max-w-[140px] rounded-lg border border-gray-100 object-contain p-1"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X size={12} />
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Upload size={20} />
                  )}
                  <span>{uploading ? 'Uploading…' : 'Click to upload logo'}</span>
                </button>
              )}

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

            {/* Primary color */}
            <div className="border-t border-gray-100 pt-5">
              <p className="mb-1 text-sm font-semibold text-gray-700">Primary Color</p>
              <p className="mb-3 text-xs text-gray-500">
                Applied to the receipt header background.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value)
                    markDirty()
                  }}
                  className="h-9 w-9 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                />
                <span className="font-mono text-sm text-gray-700">{primaryColor}</span>
              </div>
            </div>

            {/* Accent color */}
            <div className="border-t border-gray-100 pt-5">
              <p className="mb-1 text-sm font-semibold text-gray-700">Accent Color</p>
              <p className="mb-3 text-xs text-gray-500">
                Applied to receipt headings and dividers.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => {
                    setAccentColor(e.target.value)
                    markDirty()
                  }}
                  className="h-9 w-9 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                />
                <span className="font-mono text-sm text-gray-700">{accentColor}</span>
              </div>
            </div>
          </div>

          {/* Right: Receipt preview */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</p>
            <div className="mx-auto w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {/* Header */}
              <div
                className="flex flex-col items-center gap-2 px-4 py-5"
                style={{ backgroundColor: primaryColor }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="logo"
                    className="h-10 w-auto max-w-[120px] object-contain"
                  />
                ) : (
                  <span className="text-sm font-bold tracking-wide" style={{ color: '#ffffff' }}>
                    Your Business
                  </span>
                )}
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Official Receipt
                </span>
              </div>

              {/* Body */}
              <div className="space-y-1 px-4 py-3 text-[10px] text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-400">Date</span>
                  <span>Jun 26, 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">TXN #</span>
                  <span>POS-001</span>
                </div>
                <div className="my-2 border-t" style={{ borderColor: accentColor }} />
                <div className="flex justify-between">
                  <span>Item A × 2</span>
                  <span>₱200.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Item B × 1</span>
                  <span>₱150.00</span>
                </div>
                <div className="my-2 border-t" style={{ borderColor: accentColor }} />
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>Total</span>
                  <span>₱350.00</span>
                </div>
                <p className="mt-3 text-center text-[9px] text-gray-400">
                  Thank you for your purchase!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 size={14} />
            Receipt branding saved.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={!isDirty || saving}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-2 rounded-xl bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Branding'}
          </button>
        </div>
      </div>
    </div>
  )
}
