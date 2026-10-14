import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// The Receive-against-PO screen (Purchase Orders → Receive stock) had no
// coverage at all before this, despite being the point at which stock, cost
// layers and a GL entry are all written at once.
//
// Read-only by design: every assertion below stops short of posting, so the
// suite never leaves a receipt (or the PO status change behind it) in the
// e2e database. The one destructive step — Confirm & receive stock — is
// deliberately not taken.
//
// The PO is built here rather than found: the seed ships purchase orders in
// `draft` only, and draft is the one status with no Receive action, so a test
// that goes looking for a receivable PO finds nothing and quietly skips
// itself. Building one also pins down what the assertions can rely on — a
// serial-tracked line with several units, which is what makes the serial and
// duplicate checks below meaningful.

type Fixture = { poId: string; poCode: string }

async function createReceivablePo(page: Page): Promise<Fixture> {
  const json = async (url: string) =>
    (await (await page.request.get(url)).json()) as { data?: unknown[] } | undefined

  const suppliers = ((await json('/api/suppliers?limit=1'))?.data ?? []) as { id: string }[]
  expect(suppliers.length, 'a supplier is needed to raise a PO').toBeGreaterThan(0)

  // Standalone only — Scenario 27 receives into the real warehouses, never a
  // branch's own stock, and the receive screen locks to the PO's warehouse.
  const warehouses = ((
    await json('/api/inventory/warehouses?limit=200&status=active&standaloneOnly=true')
  )?.data ?? []) as { id: string }[]
  expect(warehouses.length, 'a standalone warehouse is needed').toBeGreaterThan(0)

  const items = ((await json('/api/inventory/items?limit=200'))?.data ?? []) as {
    id: string
    isSerialTracked?: boolean
  }[]
  const serialItem = items.find((i) => i.isSerialTracked)
  const plainItem = items.find((i) => !i.isSerialTracked)
  expect(serialItem, 'a serial-tracked item is needed').toBeTruthy()
  expect(plainItem, 'a non-serial-tracked item is needed').toBeTruthy()

  const created = await page.request.post('/api/procurement/purchase-orders', {
    data: {
      supplierId: suppliers[0].id,
      warehouseId: warehouses[0].id,
      paymentTerms: 'Net 30',
      notes: 'E2E fixture — receive-against-PO screen',
      lines: [
        { itemId: serialItem!.id, quantity: 3, unitPrice: 1500 },
        { itemId: plainItem!.id, quantity: 5, unitPrice: 250 },
      ],
    },
  })
  expect(created.ok(), `PO create failed: ${await created.text()}`).toBe(true)
  const po = (await created.json()) as { id: string; code: string }

  // Only a `sent` PO offers Receive in the list now (an approved one shows
  // Send), so the fixture goes approve → send.
  const approved = await page.request.patch(`/api/procurement/purchase-orders/${po.id}/approve`)
  expect(approved.ok(), `PO approve failed: ${await approved.text()}`).toBe(true)
  const sent = await page.request.patch(`/api/procurement/purchase-orders/${po.id}/send`)
  expect(sent.ok(), `PO send failed: ${await sent.text()}`).toBe(true)

  return { poId: po.id, poCode: po.code }
}

/** POs have no hard delete via the API — cancel is the closest reversible
 * action, the same tradeoff the other procurement specs make. Never throws:
 * cleanup runs in afterEach regardless of where a test body failed. */
async function cancelPo(page: Page, poId: string): Promise<void> {
  const cancelled = await page.request
    .patch(`/api/procurement/purchase-orders/${poId}/cancel`, {
      data: { reason: 'E2E fixture cleanup' },
    })
    .catch(() => null)
  // A sent PO can't be cancelled — close() is its only way out.
  if (!cancelled?.ok()) {
    await page.request
      .patch(`/api/procurement/purchase-orders/${poId}/close`, {
        data: { reason: 'E2E fixture cleanup' },
      })
      .catch(() => {})
  }
}

/** Opens the receive screen on the PO this spec built, found by its own code
 * so no other row in the list can be picked up by accident. */
async function openReceiveScreen(page: Page, poCode: string): Promise<void> {
  await gotoReady(page, '/inventory/purchase-orders')
  await expect(page.getByRole('heading', { name: 'Purchase Orders', level: 1 })).toBeVisible({
    timeout: 20_000,
  })

  // The rows arrive from a client-side query, so searching has to wait for the
  // list to exist first — querying immediately hits a list that is merely
  // still loading and finds nothing.
  const search = page.getByPlaceholder(/search/i).first()
  await expect(search).toBeVisible({ timeout: 20_000 })
  await fillStable(search, poCode)

  // A sent PO renders Receive as a primary button (aria-label "Receive stock").
  const receive = page.getByRole('button', { name: /^Receive( stock)?$/ })
  await expect(receive.first()).toBeVisible({ timeout: 20_000 })
  await receive.first().click()

  await expect(page.getByRole('heading', { name: 'Receive stock against PO' })).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('Inventory — Receive stock against a PO', () => {
  let fixture: Fixture | null = null

  test.beforeEach(async ({ page }) => {
    fixture = await createReceivablePo(page)
    await openReceiveScreen(page, fixture.poCode)
  })

  test.afterEach(async ({ page }) => {
    if (fixture) await cancelPo(page, fixture.poId)
    fixture = null
  })

  test('shows the delivery and refuses to post without a DR number', async ({ page }) => {
    await expect(page.getByText('Purchase Orders ›', { exact: false })).toBeVisible()
    await expect(page.getByText('Delivery details')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Receive all remaining' })).toBeVisible()

    // The DR number is the one thing receiving cannot proceed without: it is
    // on the paper the driver hands over with the goods, so it always exists
    // at this moment (the supplier's invoice often follows days later).
    await expect(page.getByText('Needs DR number')).toBeVisible()
    await expect(page.getByText('Delivery receipt number is required.').first()).toBeVisible()

    // Posting is refused while a blocker stands — the screen stays open.
    await page.getByRole('button', { name: 'Receive stock' }).click()
    await expect(page.getByText(/must be resolved first/).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Receive stock against PO' })).toBeVisible()

    await fillStable(
      page.getByPlaceholder('As printed on the delivery receipt'),
      'DR-E2E-RECEIVE-01'
    )
    // exact: getByText is case-insensitive, so a bare 'Confirmed' also matches
    // the action bar's "Delivery confirmed · DR-…" caption.
    await expect(page.getByText('Confirmed', { exact: true })).toBeVisible()
    await expect(page.getByText('Delivery receipt number is required.')).toHaveCount(0)
  })

  test('caps quantity at the PO remainder rather than letting an over-receipt through', async ({
    page,
  }) => {
    // The serial-tracked line was ordered 3, none received.
    const qty = page.getByRole('spinbutton', { name: 'Quantity to receive' }).first()
    await expect(qty).toHaveValue('3')

    // Typing well past the remainder snaps back to it — the backend increments
    // receivedQuantity unconditionally and only flags the variance, so the cap
    // has to hold here.
    await qty.fill('28')
    await expect(qty).toHaveValue('3')
    await expect(page.getByText('Capped at 3')).toBeVisible({ timeout: 10_000 })

    // The stepper obeys the same ceiling.
    await page.getByRole('button', { name: 'Increase quantity' }).first().click()
    await expect(qty).toHaveValue('3')

    // Down is unrestricted — a short delivery is legitimate (and, by design,
    // not flagged: the PO simply stays open for the next receipt).
    await page.getByRole('button', { name: 'Decrease quantity' }).first().click()
    await expect(qty).toHaveValue('2')
  })

  test('blocks posting until every serial on the line is unique', async ({ page }) => {
    // Serial-tracked lines open with their serial drawer expanded.
    const serials = page.getByPlaceholder(/^Serial \d+$/)
    await expect(serials).toHaveCount(3, { timeout: 10_000 })

    await fillStable(
      page.getByPlaceholder('As printed on the delivery receipt'),
      'DR-E2E-RECEIVE-02'
    )

    // The same serial twice is what stock.service.ts rejects with a 400 — it
    // is caught here instead, before the round trip.
    await fillStable(serials.nth(0), 'E2E-DUP-0001')
    await fillStable(serials.nth(1), 'E2E-DUP-0001')
    await fillStable(serials.nth(2), 'E2E-DUP-0003')

    await expect(page.getByText('Already used on this receipt.').first()).toBeVisible()
    await expect(page.getByText(/Duplicate serial E2E-DUP-0001/i).first()).toBeVisible()

    // Making it unique clears the block.
    await fillStable(serials.nth(1), 'E2E-DUP-0002')
    await expect(page.getByText('Already used on this receipt.')).toHaveCount(0)
    await expect(page.getByText(/Duplicate serial/i)).toHaveCount(0)
  })

  test('refuses to post while serial numbers are still missing', async ({ page }) => {
    await fillStable(
      page.getByPlaceholder('As printed on the delivery receipt'),
      'DR-E2E-RECEIVE-03'
    )
    // Three units ordered on the serial line, none captured.
    await expect(page.getByText(/units? still needs? serial numbers?/).first()).toBeVisible()

    await page.getByRole('button', { name: 'Receive stock' }).click()
    await expect(page.getByText(/must be resolved first/).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Receive stock against PO' })).toBeVisible()
  })
})
