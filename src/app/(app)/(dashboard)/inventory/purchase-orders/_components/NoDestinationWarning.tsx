import { AlertTriangle } from 'lucide-react'

const FORM_MESSAGE =
  'Choose a Location or add delivery instructions. You can save now, but you’ll need one of these before you can send this PO to the supplier.'

const SAVED_MESSAGE = {
  order:
    'Edit this order to choose a Location or add delivery instructions. It can’t be sent to the supplier until it has one.',
  request: 'Edit this request to choose a Location or add delivery instructions.',
  submit:
    'Go back and edit this request to choose a Location or add delivery instructions. You can’t edit it after submitting.',
}

/** Non-blocking: a request/PO may be saved with neither a Location nor
 * Delivery instructions, but the backend's send() refuses it until one is
 * set — so the buyer hears about it here, on the form or on the saved draft,
 * rather than only when Send fails. */
export function NoDestinationWarning({
  warehouseId,
  deliveryInstructions,
  saved,
}: {
  warehouseId?: string | null
  deliveryInstructions?: string | null
  /** Shown on a saved order or stock request rather than its form: the fix
   * is to edit it. 'submit' is the stock request's Submit confirm, the last
   * point it can still be edited. */
  saved?: 'order' | 'request' | 'submit'
}): React.ReactElement | null {
  if (warehouseId || deliveryInstructions?.trim()) return null
  const message = saved ? SAVED_MESSAGE[saved] : FORM_MESSAGE
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg bg-[#fdf3e7] px-3 py-2.5 text-[12px] leading-[1.45] text-[#8a4b06]"
    >
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-semibold">Where should this be delivered?</span> {message}
      </span>
    </div>
  )
}
