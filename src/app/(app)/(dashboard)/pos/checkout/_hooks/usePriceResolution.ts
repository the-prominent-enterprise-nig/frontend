'use client'

import { useEffect, useRef, useState } from 'react'
import { resolvePosPrices, type ResolvedPosPrice } from '../../_actions/pos-actions'

/** Keyed by `${itemId}::${priceUseTypeId}`, not bare itemId — two lines can
 * share an itemId (serial-tracked sibling lines) while resolving under
 * different Price Use types, so a price must be addressable per pair. */
export type PriceResolutionMap = Record<string, ResolvedPosPrice | null>

export function resolutionKey(itemId: string, priceUseTypeId: string): string {
  return `${itemId}::${priceUseTypeId}`
}

export type PriceResolutionLine = { itemId: string; priceUseTypeId?: string }

/**
 * Re-resolves every distinct (itemId, priceUseTypeId) pair in the cart —
 * each line can pick its own Price Use, so a single bulk call per Price Use
 * value already in the cart, grouped and fired in parallel, rather than one
 * call for the whole cart against one shared value. Fires only when the
 * *set* of distinct pairs changes (not on every quantity edit), since price
 * resolution is per-SKU-per-Price-Use, not per-line-quantity.
 */
export function usePriceResolution(
  lines: PriceResolutionLine[],
  branchId?: string
): { prices: PriceResolutionMap; isResolving: boolean } {
  const [prices, setPrices] = useState<PriceResolutionMap>({})
  const [isResolving, setIsResolving] = useState(false)
  // Dedup key — a distinct, order-independent set of `itemId:priceUseTypeId`
  // pairs joined into one string, so quantity-only cart edits (same pairs,
  // same count) don't re-trigger a network call.
  const pairs = lines.filter((l) => l.priceUseTypeId).map((l) => `${l.itemId}:${l.priceUseTypeId}`)
  const pairsKey = Array.from(new Set(pairs)).sort().join(',')
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!pairsKey) {
      setPrices({})
      return
    }
    const requestId = ++requestIdRef.current

    // Group distinct itemIds by their priceUseTypeId — one bulk call per
    // distinct Price Use value present in the cart, not one call per line.
    const itemIdsByUseType = new Map<string, Set<string>>()
    for (const pair of pairsKey.split(',')) {
      const [itemId, priceUseTypeId] = pair.split(':')
      const set = itemIdsByUseType.get(priceUseTypeId) ?? new Set<string>()
      set.add(itemId)
      itemIdsByUseType.set(priceUseTypeId, set)
    }

    setIsResolving(true)
    Promise.all(
      Array.from(itemIdsByUseType.entries()).map(([priceUseTypeId, itemIds]) =>
        resolvePosPrices(priceUseTypeId, Array.from(itemIds), branchId).then((res) => ({
          priceUseTypeId,
          res,
        }))
      )
    ).then((results) => {
      if (requestId !== requestIdRef.current) return // a newer request superseded this one
      setIsResolving(false)
      const merged: PriceResolutionMap = {}
      for (const { priceUseTypeId, res } of results) {
        if (!res.success || !res.data) continue
        for (const [itemId, resolved] of Object.entries(res.data)) {
          merged[resolutionKey(itemId, priceUseTypeId)] = resolved
        }
      }
      setPrices(merged)
    })
  }, [pairsKey, branchId])

  return { prices, isResolving }
}
