/**
 * General Stockbook's "Stock Transfer" (and the UDS list's "Send to Main") hands the ticked units to the Transfers
 * form through sessionStorage, not the URL: the form reads it once on mount and
 * removes it, so a refresh or Back can't reopen a stale draft.
 *
 * sessionStorage belongs to the tab, not the user, so the draft carries who
 * made it: after a sign-out and sign-in as someone else in the same tab, the
 * next user never opens a form pre-filled with units they can't see.
 */

export type PinnedLine = { itemId: string; itemLabel?: string; serialNumberId: string }

export type StockTransferDraft = {
  fromWarehouseId: string
  pinnedLines: PinnedLine[]
  /** A repair ticket's trip: the destination is fixed to Main. */
  toMain?: boolean
  reason?: string
}

type StoredDraft = StockTransferDraft & { userId: string }

const KEY = 'inventory:stock-transfer-draft'

export function saveStockTransferDraft(draft: StockTransferDraft, userId: string): void {
  const stored: StoredDraft = { ...draft, userId }
  window.sessionStorage.setItem(KEY, JSON.stringify(stored))
}

/** Reads and removes the pending draft. Anything malformed, or made by
 * another user, is discarded. */
export function consumeStockTransferDraft(userId: string): StockTransferDraft | null {
  const raw = window.sessionStorage.getItem(KEY)
  if (!raw) return null
  window.sessionStorage.removeItem(KEY)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const {
      fromWarehouseId,
      pinnedLines,
      toMain,
      reason,
      userId: owner,
    } = parsed as Record<string, unknown>
    if (owner !== userId) return null
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
    if (lines.length === 0) return null
    return {
      fromWarehouseId,
      pinnedLines: lines,
      toMain: toMain === true,
      reason: typeof reason === 'string' ? reason : undefined,
    }
  } catch {
    return null
  }
}
