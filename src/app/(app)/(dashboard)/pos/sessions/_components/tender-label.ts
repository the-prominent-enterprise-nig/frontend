/** Human label for a PosPaymentMethod key, e.g. bank_transfer -> Bank Transfer. */
export function methodLabel(method: string): string {
  if (method === 'qr') return 'QR / Online'
  if (method === 'tpf') return 'TPF'
  return method
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Label for a tender key, which the backend emits either as a bare method
 * ('qr') or as method + the provider the cashier picked at checkout
 * ('qr::Maya', 'card::BDO'). A shift is settled per provider, so the provider
 * is the part that matters here — 'QR / Online — Maya' is checkable against a
 * Maya settlement report, a lumped 'QR / Online' is not. Bare keys still
 * render as before, which keeps sessions closed before this shipped readable.
 */
export function tenderLabel(key: string): string {
  const [method, ...rest] = key.split('::')
  const provider = rest.join('::').trim()
  return provider ? `${methodLabel(method)} — ${provider}` : methodLabel(method)
}
