'use client'

import { useEffect, useRef, useState } from 'react'
import { resolvePosPrices, type ResolvedPosPrice } from '../../_actions/pos-actions'

export type PriceResolutionMap = Record<string, ResolvedPosPrice | null>

/**
 * Re-resolves every distinct itemId in the cart against the sale's selected
 * Price Use in one bulk call — fires only when priceUseTypeId or the *set*
 * of distinct itemIds changes (not on every quantity edit), since price
 * resolution is per-SKU, not per-line-quantity.
 */
export function usePriceResolution(
  priceUseTypeId: string,
  itemIds: string[],
  branchId?: string
): { prices: PriceResolutionMap; isResolving: boolean } {
  const [prices, setPrices] = useState<PriceResolutionMap>({})
  const [isResolving, setIsResolving] = useState(false)
  // Dedup key — a distinct, order-independent set of itemIds joined into one
  // string, so quantity-only cart edits (same items, same count) don't
  // re-trigger a network call.
  const itemIdsKey = Array.from(new Set(itemIds)).sort().join(',')
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!priceUseTypeId || !itemIdsKey) {
      setPrices({})
      return
    }
    const requestId = ++requestIdRef.current
    setIsResolving(true)
    resolvePosPrices(priceUseTypeId, itemIdsKey.split(','), branchId).then((res) => {
      if (requestId !== requestIdRef.current) return // a newer request superseded this one
      setIsResolving(false)
      if (res.success && res.data) setPrices(res.data)
    })
  }, [priceUseTypeId, itemIdsKey, branchId])

  return { prices, isResolving }
}
