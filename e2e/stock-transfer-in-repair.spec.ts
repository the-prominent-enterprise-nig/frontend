import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, cancelStockTransfer } from './utils'

// Scenario 72 Part 9: on the General Stockbook, a unit in repair can be ticked
// for a Stock Transfer like a shelf unit. Sent to main, it takes its repair
// ticket with it: the new transfer replaces the ticket's serial-less draft.
//
// Cleanup: the transfer is cancelled and the ticket cancelled, which puts the
// unit back in stock where it started.

type Row = Record<string, unknown> & { id: string }

test.describe('General Stockbook — in-repair units on a Stock Transfer', () => {
  test.beforeEach(async ({ page }) => {
    // The TanStack Query devtools toggle floats over the bottom-right of the
    // form and intercepts clicks — same fix as delivery-receipts.spec.ts.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent = '.tsqd-parent-container { display: none !important; }'
        document.head.appendChild(style)
      })
    })
  })

  test('a unit in repair is ticked and sent to main, carrying its repair ticket', async ({
    page,
    request,
  }) => {
    const json = async (url: string, params: Record<string, string> = {}) =>
      (await request.get(url, { params })).json()
    const branches = (await json('/api/branches', { limit: '200' })).data as (Row & {
      name: string
    })[]
    const main = branches.find((b) => b.isMainBranch)
    test.skip(!main, 'no main branch in this database')
    const warehouses = (await json('/api/inventory/warehouses', { limit: '200', status: 'active' }))
      .data as Row[]

    // A unit on a branch shelf, away from main.
    let serial: (Row & { serialNumber: string }) | undefined
    let warehouseId = ''
    for (const w of warehouses.filter((w) => w.branchId && w.branchId !== main!.id)) {
      const found = (
        await json('/api/inventory/serial-numbers', {
          warehouseId: w.id,
          status: 'in_stock',
          limit: '1',
        })
      ).data as (Row & { serialNumber: string; openTransfer?: unknown })[]
      if (found[0] && !found[0].openTransfer) {
        serial = found[0]
        warehouseId = w.id
        break
      }
    }
    test.skip(!serial, 'no in-stock serial at a branch')

    const created = await request.post('/api/inventory/uds', {
      data: {
        warehouseId,
        reason: 'repair',
        notes: 'E2E-TRFREP ticket',
        lines: [{ serialNumberId: serial!.id }],
      },
    })
    expect(created.ok(), await created.text()).toBe(true)
    const uds = (await created.json()) as { id: string; linkedStockTransfer?: { id: string } }
    const autoDraftId = uds.linkedStockTransfer?.id
    let transferId: string | undefined

    try {
      await gotoReady(page, '/inventory/stock?tab=serials')
      await fillStable(
        page.getByPlaceholder('Search serial, brand, model, category, RR or supplier…'),
        serial!.serialNumber
      )
      const tick = page.getByRole('checkbox', { name: `Select ${serial!.serialNumber}` })
      await expect(tick).toBeVisible({ timeout: 20_000 })
      await tick.check()
      await page.getByRole('button', { name: 'Stock Transfer' }).click()

      await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeVisible({
        timeout: 20_000,
      })
      const destination = page.getByPlaceholder('Search destination branch…')
      await destination.click()
      await destination.fill(main!.name)
      await page
        .getByTestId('searchable-select-option')
        .filter({ hasText: main!.name })
        .first()
        .click()
      await page.locator('form button[type="submit"]').click()
      await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toHaveCount(0, {
        timeout: 20_000,
      })

      const after = (await json(`/api/inventory/uds/${uds.id}`)) as {
        linkedStockTransfer: { id: string; status: string } | null
      }
      transferId = after.linkedStockTransfer?.id
      expect(transferId).toBeTruthy()
      expect(transferId).not.toBe(autoDraftId)
      const transfer = (await json(`/api/inventory/transfers/${transferId}`)) as {
        lines: { serialNumberId: string | null; repairUnit: boolean }[]
      }
      expect(transfer.lines[0].serialNumberId).toBe(serial!.id)
      expect(transfer.lines[0].repairUnit).toBe(true)
      if (autoDraftId) {
        const old = (await json(`/api/inventory/transfers/${autoDraftId}`)) as { status: string }
        expect(old.status).toBe('cancelled')
      }
    } finally {
      if (transferId) await cancelStockTransfer(request, transferId)
      await request.patch(`/api/inventory/uds/${uds.id}/status`, {
        data: { status: 'cancelled' },
      })
    }
  })
})
