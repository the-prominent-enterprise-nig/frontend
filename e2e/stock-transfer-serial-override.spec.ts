import { test, expect } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

// Scenario 29 SN-01 — supervisor override on transfer serial mismatches. A
// dispatcher can force through a serial that fails the normal in-stock/
// source-warehouse check (stale system record, physically correct unit) if
// they hold inventory:transfers:serial-override and give a reason. Runs as
// Business Owner (unrestricted, and per this project's role hierarchy always
// holds any Employee/Branch-Manager-level capability too).
//
// Fixture setup goes through the API directly (create + accept) — the UI's
// dropdown-based create flow can't deterministically hand us a serial that's
// physically at a THIRD warehouse (neither the transfer's own from nor to),
// and that mismatch is the entire point of this test. What's under test —
// the override checkbox/reason UI and its effect on dispatch — lives
// entirely in TransferDetailModal.tsx, which doesn't care how the
// transfer/accept got there.
//
// Not self-cleaning past dispatch: the shared cancelStockTransfer helper
// only works up to 'draft' (pre-dispatch); once dispatched this becomes a
// real (if fictitious) stock movement left at 'in_transit' — the same
// tradeoff the existing accept-reject spec's own full-lifecycle test makes.

test.describe('Inventory — Stock Transfer supervisor serial override', () => {
  test('a wrong-warehouse serial can be force-dispatched with a reason, and the override is recorded', async ({
    page,
  }) => {
    const uniqueReason = `E2E-TRF-OVERRIDE-${Date.now()}`

    const warehousesRes = await page.request.get('/api/inventory/warehouses?limit=200')
    const warehouses = ((await warehousesRes.json()).data ?? []) as { id: string }[]
    expect(warehouses.length).toBeGreaterThanOrEqual(3)

    // Resolve the fixture from what the seed actually holds rather than
    // naming an SKU. Every hardcoded SKU in this directory has now gone stale
    // at least once — TN-REF-001 disappeared when seedNigAgingCatalog started
    // seeding real refrigerator models, and TN-FURN-SET-001 (which this spec
    // used to name, with a comment promising it was seeded everywhere) is
    // likewise absent from the current seed. Asking the API for a real
    // in-stock serial and working backwards to its item and warehouse cannot
    // drift the same way.
    const serialsRes = await page.request.get('/api/inventory/serial-numbers', {
      params: { status: 'in_stock', limit: '200' },
    })
    const allSerials = ((await serialsRes.json()).data ?? []) as {
      id: string
      serialNumber: string
      itemId: string
      currentWarehouseId: string | null
    }[]

    // The override path is specifically about dispatching a serial that is
    // NOT at the transfer's source warehouse, so the serial's own warehouse
    // has to be excluded from both ends of the transfer — pick it first and
    // choose from/to around it.
    // Keep the original, known-good transfer pair — shifting it around
    // whichever warehouse the serial happens to sit in produced pairs the
    // create endpoint rejects.
    const fromWarehouse = warehouses[0]
    const toWarehouse = warehouses[1]

    // The override path is specifically about dispatching a serial that is
    // NOT at the transfer's source warehouse, so take any in-stock serial
    // parked somewhere other than this transfer's two ends.
    const candidate = allSerials.find(
      (serial) =>
        !!serial.currentWarehouseId &&
        serial.currentWarehouseId !== fromWarehouse.id &&
        serial.currentWarehouseId !== toWarehouse.id
    )
    if (!candidate) throw new Error('no in-stock serial found outside the transfer route')
    const mismatchedSerial = candidate

    const item = { id: mismatchedSerial.itemId }

    const createRes = await page.request.post('/api/inventory/transfers', {
      data: {
        fromWarehouseId: fromWarehouse.id,
        toWarehouseId: toWarehouse.id,
        transferDate: new Date().toISOString().split('T')[0],
        reason: uniqueReason,
        lines: [{ itemId: item.id, quantity: 1 }],
      },
    })
    expect(createRes.ok()).toBeTruthy()
    const transfer = await createRes.json()

    const acceptRes = await page.request.patch(`/api/inventory/transfers/${transfer.id}/accept`, {
      data: {},
    })
    expect(acceptRes.ok()).toBeTruthy()

    await gotoReady(page, '/inventory/transfers')
    await expect(async () => {
      await page.locator('tbody tr').first().click()
      await expect(page.getByRole('heading', { name: 'Transfer Details' })).toBeVisible({
        timeout: 3_000,
      })
      const isMine = await page
        .getByText(uniqueReason, { exact: true })
        .isVisible()
        .catch(() => false)
      if (!isMine) {
        await page.getByRole('button', { name: 'Close dialog' }).click()
        throw new Error('opened transfer is not the one just created — retrying')
      }
    }).toPass({ timeout: 20_000 })

    // The detail view is a right-hand drawer over a dimmed page, so the
    // wrapper is `fixed`. Queries scope into it because the overlay contains
    // the panel.
    const modal = page.locator('.fixed.inset-0.z-50')
    // 'draft' is the accepted-but-not-yet-dispatched status; the list/detail
    // UI displays it as "Accepted" (see TransferDetailModal's STATUS map).
    await expect(modal.getByText('Accepted', { exact: true })).toBeVisible({ timeout: 10_000 })

    await modal.getByRole('button', { name: 'Dispatch' }).click()
    await expect(modal.getByRole('button', { name: 'Confirm Dispatch' })).toBeVisible({
      timeout: 10_000,
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    await fillStable(modal.locator('input[type="date"]').first(), tomorrow)

    // The picker defaults to the narrow, in-stock-at-source list even for an
    // override-capable user — it only widens to a tenant-wide live search
    // once "Supervisor override" is actually ticked, so a normal dispatch
    // never surfaces every other branch's serials by default.
    await modal.getByText('Supervisor override', { exact: false }).click()

    // The reason has to be typed BEFORE the serial is picked. Both the
    // checkbox and this input live inside the group's
    // `firstEmptyIndex !== undefined` block, and the component copies the
    // reason onto the slot at firstEmptyIndex — so filling the only empty
    // slot unmounts the very input the reason would have been typed into.
    const overrideReason = 'E2E — physically confirmed on the shelf, system record is stale'
    await fillStable(modal.getByPlaceholder('Reason for the override (required)'), overrideReason)

    // SearchCombobox renders a BUTTON when closed and only swaps in the search
    // <input> once opened (see its own comment), so the freshly-widened picker
    // cannot be reached with getByPlaceholder until it has been clicked open.
    await modal
      .getByRole('button', { name: /Search any serial number/ })
      .first()
      .click()
    const serialInput = modal.getByPlaceholder('Search any serial number…')
    await expect(serialInput).toBeVisible({ timeout: 10_000 })
    await serialInput.fill(mismatchedSerial.serialNumber)
    // SearchCombobox's dropdown renders via createPortal(document.body), not
    // nested under the modal's own DOM subtree — must be found via `page`.
    const serialOption = page
      .getByRole('button', { name: new RegExp(mismatchedSerial.serialNumber) })
      .first()
    await expect(serialOption).toBeVisible({ timeout: 10_000 })
    await serialOption.click()

    await fillStable(modal.getByPlaceholder('e.g. Juan dela Cruz'), 'E2E Driver')
    await fillStable(modal.getByPlaceholder('e.g. 09171234567'), '09170001111')
    await fillStable(modal.getByPlaceholder('e.g. ABC 1234'), 'E2E 001')
    await fillStable(modal.getByPlaceholder('e.g. LBC Express'), 'E2E Carrier')

    await modal.getByRole('button', { name: 'Confirm Dispatch' }).click()
    await expect(modal.getByText('In Transit', { exact: true })).toBeVisible({ timeout: 10_000 })

    await modal.getByRole('button', { name: 'Close dialog' }).click()

    // The audit trail (who/when/why) isn't surfaced in the UI — it's a
    // backend accountability record — so confirm it landed via a raw fetch.
    const detailRes = await page.request.get(`/api/inventory/transfers/${transfer.id}`)
    const detail = await detailRes.json()
    const line = (detail.lines as Array<Record<string, unknown>>).find(
      (l) => l.serialNumberId === mismatchedSerial.id
    )
    expect(line).toBeTruthy()
    expect(line?.serialOverrideById).toBeTruthy()
    expect(line?.serialOverrideReason).toBe(overrideReason)
  })
})
