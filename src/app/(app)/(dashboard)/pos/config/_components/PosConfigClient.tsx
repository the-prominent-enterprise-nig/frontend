'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  PackageX,
  ReceiptText,
} from 'lucide-react'
import { getActivePosConfig, upsertPosConfig } from '../../_actions/pos-actions'
import type { PosConfig } from '@/src/schema/pos'

export default function PosConfigClient() {
  const [config, setConfig] = useState<PosConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [discountThreshold, setDiscountThreshold] = useState<string>('20')
  const [receiptlessReturnDays, setReceiptlessReturnDays] = useState<string>('7')
  const [allowNegativeStock, setAllowNegativeStock] = useState(false)
  const [defaultPricingMode, setDefaultPricingMode] = useState<'inclusive' | 'exclusive'>(
    'exclusive'
  )

  useEffect(() => {
    getActivePosConfig()
      .then((configRes) => {
        setLoading(false)
        if (configRes.success && configRes.data) {
          const c = configRes.data
          setConfig(c)
          setDiscountThreshold(String(c.discountOverrideThreshold ?? 20))
          setReceiptlessReturnDays(String(c.receiptlessReturnDays ?? 7))
          setAllowNegativeStock(c.allowNegativeStock ?? false)
          setDefaultPricingMode(c.defaultPricingMode ?? 'exclusive')
        }
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    const payload = {
      existingId: config?.id,
      discountOverrideThreshold:
        discountThreshold === '' ? 0 : Math.max(0, Math.min(100, Number(discountThreshold))),
      receiptlessReturnDays:
        receiptlessReturnDays === '' ? 0 : Math.max(0, Number(receiptlessReturnDays)),
      allowNegativeStock,
      defaultPricingMode,
    }
    const res = await upsertPosConfig(payload)

    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to save configuration')
      return
    }
    if (res.data) {
      const saved = res.data as PosConfig
      setConfig(saved)
      setDiscountThreshold(String(saved.discountOverrideThreshold ?? 20))
      setReceiptlessReturnDays(String(saved.receiptlessReturnDays ?? 7))
      setAllowNegativeStock(saved.allowNegativeStock ?? false)
      setDefaultPricingMode(saved.defaultPricingMode ?? 'exclusive')
    }
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
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Settings size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">General Configuration</h1>
            <p className="text-sm text-gray-500">Checkout behaviour and stock settings.</p>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Discount override threshold */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Manager Override Threshold (%)
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Discounts above this percentage require a manager PIN to proceed at checkout.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                value={discountThreshold === '0' ? '' : discountThreshold}
                onChange={(e) => setDiscountThreshold(e.target.value)}
              />
              <span className="text-sm text-gray-500">% discount</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Receiptless Return Window (days)
            </label>
            <p className="mb-2 text-xs text-gray-500">
              How many days a customer can return an item without a receipt.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="0"
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                value={receiptlessReturnDays === '0' ? '' : receiptlessReturnDays}
                onChange={(e) => setReceiptlessReturnDays(e.target.value)}
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
          </div>

          {/* Allow negative stock */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <PackageX
                  size={16}
                  className={allowNegativeStock ? 'mt-0.5 text-amber-500' : 'mt-0.5 text-gray-400'}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Allow Sales Without Stock</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Bypasses the stock-check at checkout. Enable this if your Goods Receiving
                    warehouse is not linked to a POS terminal branch and stock availability is
                    always reported as 0.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAllowNegativeStock((v) => !v)}
                className={`relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${allowNegativeStock ? 'bg-amber-500' : 'bg-gray-200'}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${allowNegativeStock ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </div>
            {allowNegativeStock && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                Stock levels will not be validated at checkout. Make sure Goods Receiving is kept up
                to date to avoid overselling.
              </div>
            )}
          </div>

          {/* Tax-inclusive pricing */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <ReceiptText
                  size={16}
                  className={
                    defaultPricingMode === 'inclusive'
                      ? 'mt-0.5 text-purple-500'
                      : 'mt-0.5 text-gray-400'
                  }
                />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Tax-inclusive pricing</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    When enabled, item tag prices are treated as VAT-inclusive (VAT is extracted at
                    checkout). When disabled, VAT is added on top of tag prices at checkout.
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setDefaultPricingMode((v) => (v === 'inclusive' ? 'exclusive' : 'inclusive'))
                }
                className={`relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${defaultPricingMode === 'inclusive' ? 'bg-purple-600' : 'bg-gray-200'}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${defaultPricingMode === 'inclusive' ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </div>
            {defaultPricingMode === 'inclusive' && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700">
                Prices shown to customers already include VAT. Subtotals sent to the ledger are
                VAT-exclusive.
              </div>
            )}
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
            Configuration saved.
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
