'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Check, MapPin, Truck } from 'lucide-react'
import PhilippineAddressPicker from '@/src/components/common/PhilippineAddressPicker'
import type { PaymentMethodConfig } from '@/src/schema/pos'
import {
  CARD_INSTALLMENT_TERMS,
  DELIVER_TO_MAX,
  DELIVERY_FEE_CHECK_NUMBER_MAX,
  DELIVERY_FEE_CR_MAX,
  DELIVERY_FEE_TENDER_LABELS,
  DELIVERY_FEE_TENDERS,
  EMPTY_DELIVERY,
  deliveryFeeOptions,
  parseDeliveryFee,
  type CustomerAddress,
  type DeliveryState,
} from '../_utils/delivery'
import { PillCombobox, PillSelect } from './PillInputs'

const INPUT_CLASS =
  'w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100'
/** The same pill buttons as the sale's Cash payment mode. */
const tenderButtonClass = (active: boolean) =>
  `flex-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors ${
    active ? 'bg-purple-200 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
  }`
const OPTION_LABEL = { bank_transfer: 'Bank', qr: 'Gateway', card: 'Card Acquirer' } as const
const LINK_CLASS =
  'mt-1 text-xs font-medium text-purple-600 underline decoration-dotted underline-offset-2 hover:text-purple-800'

/**
 * Scenario 66 — Deliver to, Delivery Address and the delivery fee, captured
 * with the sale. The fee is shown here and beside the Totals, never inside
 * them: it is collected on its own collection receipt.
 */
export default function DeliverySection({
  state,
  setState,
  customerName,
  customerAddress,
  customerAddressLoading,
  unavailableReason,
  configuredMethods,
  fmt,
}: {
  state: DeliveryState
  setState: Dispatch<SetStateAction<DeliveryState>>
  customerName: string | null
  customerAddress: CustomerAddress | null
  customerAddressLoading: boolean
  /** Why delivery can't be taken right now (offline, a resumed tab), or null. */
  unavailableReason: string | null
  /** The branch's payment methods — the fee's bank / gateway / acquirer
   * lists are the sale's own. */
  configuredMethods: PaymentMethodConfig[]
  fmt: (n: number) => string
}) {
  const fee = parseDeliveryFee(state.fee)
  const hasFee = fee !== null && fee > 0
  const showCustomerAddress = state.addressSource === 'customer' && !!customerAddress?.address
  const showSavedAddress = state.addressSource === 'picked' && state.addressSaved
  // The picker opens on the saved pick when reopened from it, otherwise on
  // the customer's own address.
  const pickerSeed = state.pickerSeed ?? customerAddress

  const tenderOptions = deliveryFeeOptions(state.tender, configuredMethods)
  const optionLabel = OPTION_LABEL[state.tender as keyof typeof OPTION_LABEL]

  const switchToCustomerAddress = () =>
    setState((s) => ({ ...s, addressSource: 'customer', addressSaved: false, pickerSeed: null }))

  return (
    <div className="border-b border-purple-200 p-5" data-testid="delivery-section">
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-700">
          <Truck size={13} />
          Delivery
        </span>
        <span className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            data-testid="delivery-toggle"
            checked={state.enabled}
            disabled={!!unavailableReason && !state.enabled}
            onChange={(e) =>
              setState(e.target.checked ? { ...EMPTY_DELIVERY, enabled: true } : EMPTY_DELIVERY)
            }
            className="h-4 w-4 accent-purple-600"
          />
          For delivery
        </span>
      </label>
      {unavailableReason && (
        <p className="mt-1.5 text-xs text-amber-600" data-testid="delivery-unavailable">
          {unavailableReason}
        </p>
      )}

      {state.enabled && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-[13px] text-gray-700" htmlFor="delivery-deliver-to">
              Deliver to *
            </label>
            <input
              id="delivery-deliver-to"
              type="text"
              aria-label="Deliver to"
              value={state.deliverTo}
              onChange={(e) =>
                setState((s) => ({ ...s, deliverTo: e.target.value, deliverToEdited: true }))
              }
              placeholder={customerName ?? 'Who receives the delivery'}
              maxLength={DELIVER_TO_MAX}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <p className="mb-1 text-[13px] text-gray-700">Delivery Address *</p>
            {customerAddressLoading ? (
              <p className="text-xs text-gray-500">Loading the customer&apos;s address…</p>
            ) : showCustomerAddress ? (
              <div
                className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2"
                data-testid="delivery-customer-address"
              >
                <p className="flex items-start gap-1.5 text-xs text-gray-800">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-purple-500" />
                  <span>{customerAddress!.address}</span>
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      addressSource: 'picked',
                      pickedAddress: customerAddress!.address,
                      pickedBarangayCode: customerAddress!.barangayCode ?? '',
                      addressSaved: false,
                      pickerSeed: null,
                    }))
                  }
                  className={LINK_CLASS}
                >
                  Change address
                </button>
              </div>
            ) : showSavedAddress ? (
              <div
                className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2"
                data-testid="delivery-saved-address"
              >
                <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-green-700">
                  <Check size={12} />
                  {customerAddress?.address ? 'Edited address saved' : 'Address saved'}
                </p>
                <p className="flex items-start gap-1.5 text-xs text-gray-800">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-purple-500" />
                  <span>{state.pickedAddress}</span>
                </p>
                <div className="mt-1 flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        addressSaved: false,
                        pickerSeed: {
                          address: s.pickedAddress,
                          barangayCode: s.pickedBarangayCode || null,
                        },
                        pickerKey: s.pickerKey + 1,
                      }))
                    }
                    className={LINK_CLASS}
                  >
                    Change address
                  </button>
                  {customerAddress?.address && (
                    <button type="button" onClick={switchToCustomerAddress} className={LINK_CLASS}>
                      Use the customer&apos;s address
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div data-testid="delivery-address-picker">
                <PhilippineAddressPicker
                  // Re-mounted only when it should start over (see
                  // DeliveryState.pickerKey) — a key that changed on every
                  // pick would wipe what the cashier just chose.
                  key={state.pickerKey}
                  initialAddress={pickerSeed?.address || undefined}
                  initialBarangayCode={pickerSeed?.barangayCode || undefined}
                  onChange={({ address, barangayCode }) =>
                    setState((s) =>
                      // The picker reports '' while it is still blank —
                      // that isn't the cashier choosing an address.
                      address === '' && s.addressSource === 'customer'
                        ? s
                        : {
                            ...s,
                            addressSource: 'picked',
                            pickedAddress: address,
                            pickedBarangayCode: barangayCode,
                            addressSaved: false,
                          }
                    )
                  }
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  {state.addressSource === 'picked' && customerAddress?.address ? (
                    <button type="button" onClick={switchToCustomerAddress} className={LINK_CLASS}>
                      Use the customer&apos;s address
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    data-testid="delivery-save-address"
                    disabled={state.addressSource !== 'picked' || !state.pickedAddress.trim()}
                    onClick={() => setState((s) => ({ ...s, addressSaved: true }))}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    Save address
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[13px] text-gray-700" htmlFor="delivery-fee">
              Delivery fee
            </label>
            <input
              id="delivery-fee"
              type="text"
              inputMode="decimal"
              aria-label="Delivery fee"
              value={state.fee}
              onChange={(e) => setState((s) => ({ ...s, fee: e.target.value }))}
              placeholder="0.00 — leave blank for free delivery"
              className={`${INPUT_CLASS} text-right`}
            />
            {fee === null && (
              <p className="mt-1 text-xs text-red-600">Enter an amount like 150 or 150.50.</p>
            )}
          </div>

          {hasFee && (
            <div className="space-y-2">
              <div
                className="rounded-lg border border-purple-100 p-2.5"
                data-testid="delivery-fee-method"
              >
                <p className="mb-1.5 text-xs font-medium text-gray-800">Paid with *</p>
                <div className="flex gap-1.5">
                  {DELIVERY_FEE_TENDERS.map((tender) => (
                    <button
                      key={tender}
                      type="button"
                      aria-pressed={state.tender === tender}
                      onClick={() =>
                        // A new tender starts its details over, as the sale's does.
                        setState((s) => ({
                          ...s,
                          tender,
                          checkNumber: '',
                          optionId: undefined,
                          bankVerified: false,
                          cardTxnMode: 'straight',
                          cardTerm: undefined,
                        }))
                      }
                      className={tenderButtonClass(state.tender === tender)}
                    >
                      {DELIVERY_FEE_TENDER_LABELS[tender]}
                    </button>
                  ))}
                </div>

                {tenderOptions.length > 0 && optionLabel && (
                  <PillCombobox
                    ariaLabel={`Delivery fee ${optionLabel}`}
                    wrapperClassName="mt-1.5"
                    placeholder={`Select ${optionLabel.toLowerCase()}…`}
                    options={tenderOptions.map((o) => ({ value: o.id, label: o.name }))}
                    value={state.optionId}
                    onChange={(optionId) => setState((s) => ({ ...s, optionId }))}
                  />
                )}

                {state.tender === 'check' && (
                  <input
                    aria-label="Delivery fee check number"
                    className="mt-1.5 w-full rounded-lg border-2 border-purple-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-gray-800 shadow-sm outline-none transition-colors placeholder:font-semibold placeholder:text-gray-600 hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    placeholder="Check Number (required)"
                    maxLength={DELIVERY_FEE_CHECK_NUMBER_MAX}
                    value={state.checkNumber}
                    onChange={(e) => setState((s) => ({ ...s, checkNumber: e.target.value }))}
                  />
                )}

                {state.tender === 'bank_transfer' && (
                  <label className="mt-1.5 flex items-center gap-1.5 text-[12px] text-gray-700">
                    <input
                      type="checkbox"
                      checked={state.bankVerified}
                      onChange={(e) => setState((s) => ({ ...s, bankVerified: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    Verified at register — the credit already landed, post straight to Cash in Bank
                  </label>
                )}

                {state.tender === 'card' && (
                  <>
                    <div className="mt-1.5 flex gap-1.5">
                      {(['straight', 'installment'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={state.cardTxnMode === mode}
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              cardTxnMode: mode,
                              cardTerm: mode === 'straight' ? undefined : s.cardTerm,
                            }))
                          }
                          className={tenderButtonClass(state.cardTxnMode === mode)}
                        >
                          {mode === 'straight' ? 'Straight' : 'Installment'}
                        </button>
                      ))}
                    </div>
                    {state.cardTxnMode === 'installment' && (
                      <PillSelect
                        aria-label="Delivery fee card term"
                        filled={!!state.cardTerm}
                        wrapperClassName="mt-1.5"
                        value={state.cardTerm ?? ''}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            cardTerm: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                      >
                        <option value="">Select Term (required)</option>
                        {CARD_INSTALLMENT_TERMS.map((m) => (
                          <option key={m} value={m}>
                            {m} months
                          </option>
                        ))}
                      </PillSelect>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[13px] text-gray-700" htmlFor="delivery-fee-cr">
                  Delivery fee CR No. *
                </label>
                <input
                  id="delivery-fee-cr"
                  type="text"
                  aria-label="Delivery fee CR No."
                  value={state.feeCr}
                  onChange={(e) => setState((s) => ({ ...s, feeCr: e.target.value }))}
                  placeholder="Delivery CR Number"
                  maxLength={DELIVERY_FEE_CR_MAX}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          )}

          <p className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
            {hasFee
              ? `${fmt(fee!)} is collected on its own collection receipt — it is not part of the sale total.`
              : 'Free delivery — no fee to collect.'}
          </p>
        </div>
      )}
    </div>
  )
}
