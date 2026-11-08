import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 86 Part 1.
//
// DC-02 follow-up — the collections screen's "today" is the Manila date. It
// was the UTC date, so between 00:00 and 08:00 Manila the date fields topped
// out at yesterday and today could not be picked. The browser clock is pinned
// to exact Manila instants; the same checks also run with the browser set to
// another timezone, since the screen must not depend on the computer's zone.
//
// STR-02 — the serial number on a transfer's Receive panel is as dark and
// prominent as everywhere else (it was light grey).

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const RECEIVER_EMAIL = 'technova.stock@test.com' // Stock Controller, all branches

const manilaToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now)

async function openCollectionsAt(page: Page, instant: string) {
  await page.clock.setFixedTime(new Date(instant))
  await gotoReady(page, '/pos/collections')
  const field = page.getByTestId('collections-override-date')
  await expect(field).toBeVisible({ timeout: 20_000 })
  return field
}

for (const zone of [undefined, 'America/Los_Angeles'] as const) {
  test.describe(`Collections date is the Manila date${zone ? ` (browser in ${zone})` : ''}`, () => {
    if (zone) test.use({ timezoneId: zone })

    test('at 07:30 Manila — still yesterday in UTC — today is the default and the latest date offered', async ({
      page,
    }) => {
      const today = manilaToday()
      const field = await openCollectionsAt(page, `${today}T07:30:00+08:00`)
      await expect(field).toHaveAttribute('max', today)
      await expect(field).toHaveValue(today)
    })

    test('at 23:59 Manila the latest date offered is still today, never tomorrow', async ({
      page,
    }) => {
      const today = manilaToday()
      const field = await openCollectionsAt(page, `${today}T23:59:00+08:00`)
      await expect(field).toHaveAttribute('max', today)
      await expect(field).toHaveValue(today)
    })

    test('at 00:00:05 Manila the new day is already today', async ({ page }) => {
      const today = manilaToday()
      const field = await openCollectionsAt(page, `${today}T00:00:05+08:00`)
      await expect(field).toHaveAttribute('max', today)
    })
  })
}

test.describe('Transfer Receive panel — serial number styling (STR-02)', () => {
  test.describe.configure({ timeout: 120_000 })

  test('the serial on the Receive panel is dark and bold, not light grey', async ({
    page,
    browser,
  }) => {
    // Fixture, as the Business Owner: a one-unit transfer of a real in-stock
    // serial out of its own warehouse, accepted and dispatched through the API.
    const warehousesRes = await page.request.get('/api/inventory/warehouses?limit=200')
    const warehouses = ((await warehousesRes.json()).data ?? []) as {
      id: string
      status?: string
    }[]
    const serialsRes = await page.request.get('/api/inventory/serial-numbers', {
      params: { status: 'in_stock', limit: '200' },
    })
    const serials = ((await serialsRes.json()).data ?? []) as {
      id: string
      serialNumber: string
      itemId: string
      currentWarehouseId: string | null
    }[]

    const reason = `E2E S86 STR-02 ${Date.now()}`
    let transfer: { id: string; transferNumber: string } | null = null
    let serial: (typeof serials)[number] | null = null
    for (const candidate of serials.filter((s) => s.currentWarehouseId)) {
      const to = warehouses.find(
        (w) => w.id !== candidate.currentWarehouseId && (w.status ?? 'active') === 'active'
      )
      if (!to) continue
      const createRes = await page.request.post('/api/inventory/transfers', {
        data: {
          fromWarehouseId: candidate.currentWarehouseId,
          toWarehouseId: to.id,
          transferDate: manilaToday(),
          reason,
          lines: [{ itemId: candidate.itemId, quantity: 1 }],
        },
      })
      if (!createRes.ok()) continue
      transfer = await createRes.json()
      serial = candidate
      break
    }
    expect(transfer, 'no in-stock serial could be put on a transfer').toBeTruthy()

    const accepted = await page.request.patch(`/api/inventory/transfers/${transfer!.id}/accept`, {
      data: {},
    })
    expect(accepted.ok(), await accepted.text()).toBeTruthy()
    const detail = await (await page.request.get(`/api/inventory/transfers/${transfer!.id}`)).json()
    const lineId = (detail.lines as { id: string }[])[0].id
    const dispatched = await page.request.patch(
      `/api/inventory/transfers/${transfer!.id}/dispatch`,
      {
        data: {
          serialAssignments: [{ lineId, serialNumberId: serial!.id }],
          driverName: 'E2E Driver',
          driverPhone: '09170001111',
          vehiclePlate: 'E2E 086',
          carrierName: 'E2E Carrier',
        },
      }
    )
    expect(dispatched.ok(), await dispatched.text()).toBeTruthy()

    // A different user receives: whoever dispatched never can (WH-01).
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const receiver = await context.newPage()
    await loginAs(receiver, RECEIVER_EMAIL, DEV_PASSWORD)
    await gotoReady(receiver, `/inventory/transfers?transfer=${transfer!.transferNumber}`)
    const modal = receiver.locator('.fixed.inset-0.z-50')
    await expect(modal.getByText(reason, { exact: true })).toBeVisible({ timeout: 20_000 })

    await modal.getByRole('button', { name: 'Receive', exact: true }).click()
    const serialText = modal.getByTestId('receive-line-serial')
    await expect(serialText).toHaveText(serial!.serialNumber)
    // #0b0b0f, semibold — the same as the detail table's serial cell; it was
    // text-zinc-400.
    await expect(serialText).toHaveCSS('color', 'rgb(11, 11, 15)')
    await expect(serialText).toHaveCSS('font-weight', '600')

    // Clean-up: a dispatched transfer can't be cancelled, so the receiver
    // finishes the receipt — nothing is left stuck in transit.
    const received = await receiver.request.patch(
      `/api/inventory/transfers/${transfer!.id}/receive`,
      {
        data: {
          receivedDate: manilaToday(),
          notes: 'E2E S86 clean-up',
          lines: [{ stockTransferLineId: lineId, quantityReceived: 1 }],
        },
      }
    )
    expect(received.ok(), await received.text()).toBeTruthy()

    await context.close()
  })
})
