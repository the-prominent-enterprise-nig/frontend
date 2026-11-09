import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Nov UAT — "As a Custodian, I want to receive partial or different serial from ST."
//
//   2. "When receiving different serial or Model, it must also from existing
//      serial within NIG. You must search serial within NIG even not from
//      originating branch. You can never encode serial that is not received
//      within NIG."
//
// On the Receive panel:
//   - "Different unit arrived?" is open to whoever receives (no serial-override
//     permission). It searches existing in-stock serials of the item across
//     every branch; typing only searches, a scanner's code + Enter picks the
//     exact match, and nothing typed is ever saved. "Fix typo" is gone.
//   - A different model goes under Unlisted Items, whose serial-tracked units
//     are picked the same way — no free-text serial boxes.
//
// Backend rules (stock moved out of the old warehouse, refusals, the race) are
// covered by backend/test/stock-transfer-receipt-serial-correction.e2e-spec.ts.
//
// Fixtures are built as the Business Owner through the API: two serial-tracked
// items and serials registered at three branches (source Bago, destination
// Binalbagan, and a third branch). A branch stock user at the destination
// receives — whoever dispatched never can (WH-01).

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const RECEIVER_EMAIL = 'technova.b2.stock@test.com' // Binalbagan (B2) stock user
const SOURCE_BRANCH = 'Bago'
const DEST_BRANCH = 'Binalbagan'
const PREFIX = 'E2E RecvExisting'

const manilaToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now)

type Warehouse = { id: string; name: string; branchId: string | null; status?: string }
type Fx = {
  stamp: string
  model: { id: string; name: string }
  otherModel: { id: string; name: string }
  source: Warehouse
  dest: Warehouse
  third: Warehouse
}
let fx: Fx

async function createSerialItem(request: APIRequestContext, label: string, stamp: string) {
  const anyItem = await request.get('/api/inventory/items?limit=1')
  const baseUnitId = ((await anyItem.json()).data ?? [])[0].baseUnit.id as string
  const name = `${PREFIX} ${label} ${stamp}`
  const res = await request.post('/api/inventory/items', {
    data: {
      sku: `E2E-RECVX-${label}-${stamp}`,
      name,
      baseUnitId,
      isSerialTracked: true,
      sellingPrice: 9000,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const item = await res.json()
  await request.post(`/api/inventory/items/${item.id}/submit`)
  await request.post(`/api/inventory/items/${item.id}/confirm-accounting`, { data: {} })
  await request.post(`/api/inventory/items/${item.id}/approve`, { data: {} })
  return { id: item.id as string, name }
}

/** Registers in-stock serials of an item at a warehouse; returns them by text. */
async function registerSerials(
  request: APIRequestContext,
  itemId: string,
  warehouseId: string,
  serials: string[]
): Promise<Map<string, string>> {
  const res = await request.post('/api/inventory/serial-numbers', {
    data: { itemId, warehouseId, serialNumbers: serials, status: 'in_stock' },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  // Search the prefix every registered serial shares (e.g. RX03-M1-… and
  // RX03-M2-… share "RX03-M"), so each one's id comes back, not just the first.
  let prefix = serials[0]
  for (const s of serials) while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1)
  const list = await request.get('/api/inventory/serial-numbers', {
    params: { itemId, search: prefix, limit: '200', scope: 'override' },
  })
  const rows = ((await list.json()).data ?? []) as { id: string; serialNumber: string }[]
  return new Map(rows.map((r) => [r.serialNumber, r.id]))
}

/** Creates, accepts and dispatches a one-unit transfer Bago → Binalbagan. */
async function dispatchedTransfer(
  request: APIRequestContext,
  itemId: string,
  serialId: string,
  reason: string
) {
  const created = await request.post('/api/inventory/transfers', {
    data: {
      fromWarehouseId: fx.source.id,
      toWarehouseId: fx.dest.id,
      transferDate: manilaToday(),
      reason,
      lines: [{ itemId, quantity: 1 }],
    },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const transfer = (await created.json()) as { id: string; transferNumber: string }
  const accepted = await request.patch(`/api/inventory/transfers/${transfer.id}/accept`, {
    data: {},
  })
  expect(accepted.ok(), await accepted.text()).toBeTruthy()
  const detail = await (await request.get(`/api/inventory/transfers/${transfer.id}`)).json()
  const lineId = (detail.lines as { id: string }[])[0].id
  const dispatched = await request.patch(`/api/inventory/transfers/${transfer.id}/dispatch`, {
    data: {
      serialAssignments: [{ lineId, serialNumberId: serialId }],
      driverName: 'E2E Driver',
      driverPhone: '09170001111',
      vehiclePlate: 'E2E 777',
      carrierName: 'E2E Carrier',
    },
  })
  expect(dispatched.ok(), await dispatched.text()).toBeTruthy()
  return { ...transfer, lineId }
}

async function openAsReceiver(browser: Browser, transferNumber: string, reason: string) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const receiver = await context.newPage()
  await loginAs(receiver, RECEIVER_EMAIL, DEV_PASSWORD)
  await gotoReady(receiver, `/inventory/transfers?transfer=${transferNumber}`)
  // The detail opens as a full-bleed panel (absolute since the Stock Transactions
  // unify, fixed before); anchor on its own "Request Details" heading.
  const modal = receiver
    .locator('.inset-0.z-50')
    .filter({ has: receiver.getByRole('heading', { name: 'Request Details', exact: true }) })
  await expect(modal.getByText(reason, { exact: true })).toBeVisible({ timeout: 20_000 })
  await modal.getByRole('button', { name: 'Mark Received' }).click()
  await expect(modal.getByTestId('receive-line-serial')).toBeVisible()
  return { context, receiver, modal }
}

/** Searches a serial box and picks the result. Works whether the box is
 * closed (a button) or still open from a previous search (a textbox — the
 * box does not close on Escape); "search or scan" matches both the first
 * and the "Add another unit — search or scan…" label. */
async function searchAndPick(page: Page, scope: ReturnType<Page['locator']>, text: string) {
  const box = scope.getByRole('textbox', { name: /search or scan/i })
  if (!(await box.isVisible())) {
    await scope.getByRole('button', { name: /search or scan/i }).click()
  }
  await box.fill(text)
  await page.getByRole('button', { name: new RegExp(text) }).click()
}

test.describe('Transfer Receive — a different serial or model, from existing NIG serials only', () => {
  test.describe.configure({ timeout: 150_000 })

  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL!,
      storageState: 'e2e/.auth/business-owner.json',
    })
    const stamp = `${Date.now()}`
    const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
      id: string
      name: string
    }[]
    const warehouses = ((await (await request.get('/api/inventory/warehouses?limit=200')).json())
      .data ?? []) as Warehouse[]
    const at = (branchName: string) => {
      const branchId = branches.find((b) => b.name === branchName)!.id
      return warehouses.find((w) => w.branchId === branchId && (w.status ?? 'active') === 'active')!
    }
    const source = at(SOURCE_BRANCH)
    const dest = at(DEST_BRANCH)
    const third = warehouses.find(
      (w) =>
        w.branchId &&
        w.branchId !== source.branchId &&
        w.branchId !== dest.branchId &&
        (w.status ?? 'active') === 'active'
    )!
    fx = {
      stamp,
      model: await createSerialItem(request, 'MODEL', stamp),
      otherModel: await createSerialItem(request, 'OTHER', stamp),
      source,
      dest,
      third,
    }
    await request.dispose()
  })

  test('RX-01: a receiver without serial-override records a different unit from a THIRD branch — searched, never typed', async ({
    page,
    browser,
  }) => {
    const s = fx.stamp
    const src = await registerSerials(page.request, fx.model.id, fx.source.id, [`RX01-D-${s}`])
    const far = await registerSerials(page.request, fx.model.id, fx.third.id, [`RX01-F-${s}`])
    const reason = `${PREFIX} RX-01 ${s}`
    const transfer = await dispatchedTransfer(
      page.request,
      fx.model.id,
      src.get(`RX01-D-${s}`)!,
      reason
    )

    const { context, receiver, modal } = await openAsReceiver(
      browser,
      transfer.transferNumber,
      reason
    )

    // No typo-fix any more, and no free-text serial box.
    await expect(modal.getByRole('button', { name: 'Fix typo' })).toHaveCount(0)
    await modal.getByTestId('receive-different-unit').click()
    const panel = modal.getByTestId('receive-different-unit-panel')
    await expect(panel.getByPlaceholder('Correct serial number')).toHaveCount(0)

    // Typing a serial NIG does not hold finds nothing to pick.
    await panel.getByRole('button', { name: /Search or scan/ }).click()
    await receiver.keyboard.type(`NOT-IN-NIG-${s}`)
    await expect(
      receiver.getByText('No in-stock serial of this item anywhere in NIG matches')
    ).toBeVisible({ timeout: 10_000 })
    await receiver.keyboard.press('Escape')

    // The unit from the third branch is found, with where it is.
    await searchAndPick(receiver, panel, `RX01-F-${s}`)
    await expect(panel.getByTestId('receive-replacement-label')).toContainText(`RX01-F-${s}`)
    await panel.getByLabel('Reason for the different unit').fill('Another branch unit was loaded')

    await modal.getByRole('button', { name: 'Confirm Receipt', exact: true }).click()
    await expect(modal.getByTestId('expected-unit-not-received')).toContainText(
      `RX01-D-${s} not received`,
      { timeout: 20_000 }
    )

    const detail = await (
      await receiver.request.get(`/api/inventory/transfers/${transfer.id}`)
    ).json()
    const line = (detail.lines as { serialNumberId: string }[])[0]
    expect(line.serialNumberId).toBe(far.get(`RX01-F-${s}`))
    await context.close()
  })

  test('RX-02 (edge): a scanner — the exact code then Enter — picks the unit without a click', async ({
    page,
    browser,
  }) => {
    const s = fx.stamp
    const src = await registerSerials(page.request, fx.model.id, fx.source.id, [`RX02-D-${s}`])
    await registerSerials(page.request, fx.model.id, fx.third.id, [`RX02-SCAN-${s}`])
    const reason = `${PREFIX} RX-02 ${s}`
    const transfer = await dispatchedTransfer(
      page.request,
      fx.model.id,
      src.get(`RX02-D-${s}`)!,
      reason
    )
    const { context, receiver, modal } = await openAsReceiver(
      browser,
      transfer.transferNumber,
      reason
    )

    await modal.getByTestId('receive-different-unit').click()
    const panel = modal.getByTestId('receive-different-unit-panel')
    await panel.getByRole('button', { name: /Search or scan/ }).click()
    // A scanner types fast and presses Enter before the search has answered.
    await receiver.keyboard.type(`RX02-SCAN-${s}`, { delay: 5 })
    await receiver.keyboard.press('Enter')
    await expect(panel.getByTestId('receive-replacement-label')).toContainText(`RX02-SCAN-${s}`, {
      timeout: 10_000,
    })
    // Enter did not submit the receipt.
    await expect(modal.getByTestId('receive-line-serial')).toBeVisible()
    await context.close()
  })

  test('RX-03: a different MODEL arrives as an unlisted unit, picked from another branch’s stock; the expected unit stays outstanding', async ({
    page,
    browser,
  }) => {
    const s = fx.stamp
    const src = await registerSerials(page.request, fx.model.id, fx.source.id, [`RX03-D-${s}`])
    const other = await registerSerials(page.request, fx.otherModel.id, fx.third.id, [
      `RX03-M1-${s}`,
      `RX03-M2-${s}`,
    ])
    const reason = `${PREFIX} RX-03 ${s}`
    const transfer = await dispatchedTransfer(
      page.request,
      fx.model.id,
      src.get(`RX03-D-${s}`)!,
      reason
    )
    const { context, receiver, modal } = await openAsReceiver(
      browser,
      transfer.transferNumber,
      reason
    )

    await modal.getByRole('button', { name: '+ Add unlisted item' }).click()
    await modal.getByRole('button', { name: /Search item by name or SKU/ }).click()
    await receiver.keyboard.type(fx.otherModel.name)
    await receiver
      .getByRole('button', { name: new RegExp(fx.otherModel.name) })
      .first()
      .click()

    const picker = modal.getByTestId('unlisted-serial-picker')
    await expect(picker).toBeVisible()
    // No one-box-per-unit free text any more.
    await expect(modal.getByPlaceholder('Serial 1')).toHaveCount(0)

    await searchAndPick(receiver, picker, `RX03-M1-${s}`)
    await searchAndPick(receiver, picker, `RX03-M2-${s}`)
    await expect(picker.getByTestId('unlisted-serial-picked')).toHaveCount(2)
    // A picked unit is not offered again.
    await picker.getByRole('button', { name: /Add another unit/ }).click()
    await receiver.keyboard.type(`RX03-M1-${s}`)
    // Only offers count: the picked chip's own "Remove serial …" button is not an offer.
    await expect(
      receiver.getByRole('button', { name: new RegExp(`^(?!Remove serial).*RX03-M1-${s}`) }),
    ).toHaveCount(0)
    await receiver.keyboard.press('Escape')
    // Remove one; it can be picked again.
    await picker.getByRole('button', { name: `Remove serial RX03-M2-${s}` }).click()
    await expect(picker.getByTestId('unlisted-serial-picked')).toHaveCount(1)

    // The dispatched unit did not come: its line stays unticked.
    await modal.getByRole('button', { name: 'Confirm Receipt', exact: true }).click()
    await expect(modal.getByText('Partially Received').first()).toBeVisible({ timeout: 20_000 })

    // The picked unit moved to the destination; the removed one stayed put.
    const where = async (serial: string) => {
      const res = await page.request.get('/api/inventory/serial-numbers', {
        // The receiver's own every-branch lookup (in stock, held by no open transfer).
        params: { itemId: fx.otherModel.id, search: serial, scope: 'receipt' },
      })
      const rows = ((await res.json()).data ?? []) as {
        id: string
        currentWarehouseId: string | null
      }[]
      return rows.find((r) => r.id === other.get(serial))?.currentWarehouseId
    }
    expect(await where(`RX03-M1-${s}`)).toBe(fx.dest.id)
    expect(await where(`RX03-M2-${s}`)).toBe(fx.third.id)
    await context.close()
  })

  test('RX-04 (edge): Enter on a partial code picks nothing and does not submit the receipt', async ({
    page,
    browser,
  }) => {
    const s = fx.stamp
    const src = await registerSerials(page.request, fx.model.id, fx.source.id, [`RX04-D-${s}`])
    await registerSerials(page.request, fx.model.id, fx.third.id, [`RX04-FULL-${s}`])
    const reason = `${PREFIX} RX-04 ${s}`
    const transfer = await dispatchedTransfer(
      page.request,
      fx.model.id,
      src.get(`RX04-D-${s}`)!,
      reason
    )
    const { context, receiver, modal } = await openAsReceiver(
      browser,
      transfer.transferNumber,
      reason
    )

    await modal.getByTestId('receive-different-unit').click()
    const panel = modal.getByTestId('receive-different-unit-panel')
    await panel.getByRole('button', { name: /Search or scan/ }).click()
    // Only part of the code: the full unit is listed, but nothing is exact.
    await receiver.keyboard.type(`RX04-FU`)
    await expect(receiver.getByRole('button', { name: new RegExp(`RX04-FULL-${s}`) })).toBeVisible({
      timeout: 10_000,
    })
    await receiver.keyboard.press('Enter')
    await expect(panel.getByTestId('receive-replacement-label')).toHaveCount(0)
    // Still on the receive form — Enter did not confirm the receipt.
    await expect(modal.getByRole('button', { name: 'Confirm Receipt', exact: true })).toBeVisible()
    await context.close()
  })

  test('RX-05 (edge): a unit picked as the line’s different unit is not offered again under Unlisted Items; cancelling the pick frees it', async ({
    page,
    browser,
  }) => {
    const s = fx.stamp
    const src = await registerSerials(page.request, fx.model.id, fx.source.id, [`RX05-D-${s}`])
    await registerSerials(page.request, fx.model.id, fx.third.id, [`RX05-U-${s}`])
    const reason = `${PREFIX} RX-05 ${s}`
    const transfer = await dispatchedTransfer(
      page.request,
      fx.model.id,
      src.get(`RX05-D-${s}`)!,
      reason
    )
    const { context, receiver, modal } = await openAsReceiver(
      browser,
      transfer.transferNumber,
      reason
    )

    await modal.getByTestId('receive-different-unit').click()
    const panel = modal.getByTestId('receive-different-unit-panel')
    await searchAndPick(receiver, panel, `RX05-U-${s}`)
    await expect(panel.getByTestId('receive-replacement-label')).toContainText(`RX05-U-${s}`)

    // The same model under Unlisted Items: the unit already picked is not listed.
    await modal.getByRole('button', { name: '+ Add unlisted item' }).click()
    await modal.getByRole('button', { name: /Search item by name or SKU/ }).click()
    await receiver.keyboard.type(fx.model.name)
    await receiver
      .getByRole('button', { name: new RegExp(fx.model.name) })
      .first()
      .click()
    const picker = modal.getByTestId('unlisted-serial-picker')
    await picker.getByRole('button', { name: /Search or scan/ }).click()
    await receiver.keyboard.type(`RX05-U-${s}`)
    await expect(
      receiver.getByText('No in-stock serial of this item anywhere in NIG matches')
    ).toBeVisible({ timeout: 10_000 })
    await receiver.keyboard.press('Escape')

    // Cancel the line's pick — now it can be picked under Unlisted Items.
    await panel.getByRole('button', { name: 'Cancel correction' }).click()
    await searchAndPick(receiver, picker, `RX05-U-${s}`)
    await expect(picker.getByTestId('unlisted-serial-picked')).toHaveCount(1)
    await context.close()
  })
})
