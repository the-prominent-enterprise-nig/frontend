'use client'

import { getCustomerReturnDocument } from '../_actions/get-customer-return-document'
import { buildCustomerReturnReceiptHtml } from '@/src/libs/print/printInventoryDocument'

/**
 * The customer's copy of a return, in its own window.
 *
 * A separate window rather than window.print() on the screen behind it: the
 * dashboard chrome is outside this route's control, so printing in place would
 * hand the customer a sidebar. The paper itself is
 * buildCustomerReturnReceiptHtml() — the shared print module, alongside the
 * supplier-side Receiving Report it has to match.
 *
 * The window opens on the click, BEFORE the fetch, and says what it is doing
 * until the envelope lands. A popup opened in the continuation of an await has
 * lost the user's click and browsers block it — which would show up as "Print
 * sometimes does nothing".
 *
 * `fallback` is for the counter, where this runs seconds after posting and the
 * customer is waiting: if the document cannot be fetched, the slip is built
 * from what was just submitted rather than not printed at all. Reprinting from
 * the list passes none — there is nothing to fall back to and nobody standing
 * there, so a failure says so.
 */
export async function printCustomerCopy(returnId: string, fallback?: () => unknown): Promise<void> {
  const win = window.open('', '_blank', 'width=950,height=750')
  if (!win) return
  win.document.write(
    '<p style="font-family:Arial,sans-serif;padding:32px;color:#555">Preparing the customer copy…</p>'
  )

  let envelope: unknown
  try {
    const res = await getCustomerReturnDocument(returnId)
    envelope = res.success && res.data ? res.data : fallback?.()
  } catch {
    envelope = fallback?.()
  }

  if (!envelope) {
    win.document.open()
    win.document.write(
      '<p style="font-family:Arial,sans-serif;padding:32px;color:#b42318">' +
        'The customer copy could not be loaded. Close this and try again.</p>'
    )
    win.document.close()
    return
  }

  win.document.open()
  win.document.write(buildCustomerReturnReceiptHtml(envelope))
  win.document.close()
}
