/**
 * General Stockbook's "Stock Transfer" hands the ticked units to the Transfers
 * form through sessionStorage, not the URL: the form reads it once on mount and
 * removes it, so a refresh or Back can't reopen a stale draft.
 */

export type PinnedLine = { itemId: string; itemLabel?: string; serialNumberId: string }

export type StockTransferDraft = { fromWarehouseId: string; pinnedLines: PinnedLine[] }

const KEY = 'inventory:stock-transfer-draft'

export function saveStockTransferDraft(draft: StockTransferDraft): void {
  window.sessionStorage.setItem(KEY, JSON.stringify(draft))
}

/** Reads and removes the pending draft. Anything malformed is discarded. */
export function consumeStockTransferDraft(): StockTransferDraft | null {
  const raw = window.sessionStorage.getItem(KEY)
  if (!raw) return null
  window.sessionStorage.removeItem(KEY)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { fromWarehouseId, pinnedLines } = parsed as Record<string, unknown>
    if (typeof fromWarehouseId !== 'string' || !Array.isArray(pinnedLines)) return null
    const lines = pinnedLines.flatMap((p): PinnedLine[] => {
      if (!p || typeof p !== 'object') return []
      const { itemId, itemLabel, serialNumberId } = p as Record<string, unknown>
      if (typeof itemId !== 'string' || typeof serialNumberId !== 'string') return []
      return [
        {
          itemId,
          serialNumberId,
          itemLabel: typeof itemLabel === 'string' ? itemLabel : undefined,
        },
      ]
    })
    return lines.length > 0 ? { fromWarehouseId, pinnedLines: lines } : null
  } catch {
    return null
  }
}
