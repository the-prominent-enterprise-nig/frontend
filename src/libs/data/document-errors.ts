export type FriendlyError = { title: string; body: string }

const DOCUMENT_ERRORS: Record<string, FriendlyError> = {
  receiving_report_not_found: {
    title: 'You can’t open this receiving report',
    body: 'It was received into a location outside your branch, or it no longer exists. Ask Head Office or the receiving branch if you need a copy.',
  },
  purchase_order_not_found: {
    title: 'You can’t open this purchase order',
    body: 'It belongs to another branch, or it no longer exists. Ask Head Office or the ordering branch if you need a copy.',
  },
}

function fallback(kind: string): FriendlyError {
  return {
    title: `This ${kind} didn’t load`,
    body: 'Something went wrong while opening it. Try again in a moment.',
  }
}

/**
 * The backend answers with short snake_case codes (receiving_report_not_found,
 * purchase_order_not_found) — this turns them into a title and a sentence for
 * the screen. Anything unknown gets a generic retry message, never the raw code.
 */
export function describeDocumentError(
  message: string | null | undefined,
  kind: 'receiving report' | 'purchase order'
): FriendlyError {
  return (message && DOCUMENT_ERRORS[message]) || fallback(kind)
}
