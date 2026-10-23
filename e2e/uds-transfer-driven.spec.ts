import { test, expect, type APIRequestContext } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 72 Part 10: a repair ticket's hops happen on their own documents.
// Also: the repair-provider list keeps only suppliers on file (Item Master)
// for the ticket's items.
// A ticket at a branch shows its own stock transfer, not Send to Main; a
// maintenance ticket closes with one Complete, confirmed in a modal with no
// status picker.
//
// Cleanup: the repair ticket is cancelled (which cancels its draft transfer);
// the maintenance ticket ends completed, its unit back in stock.

type Row = Record<string, unknown> & { id: string }

async function branchUnit(
  request: APIRequestContext
): Promise<{ warehouseId: string; serialId: string } | null> {
  const json = async (url: string, params: Record<string, string> = {}) =>
    (await request.get(url, { params })).json()
  const branches = (await json('/api/branches', { limit: '200' })).data as Row[]
  const main = branches.find((b) => b.isMainBranch)
  if (!main) return null
  const warehouses = (await json('/api/inventory/warehouses', { limit: '200', status: 'active' }))
    .data as Row[]
  for (const w of warehouses.filter((w) => w.branchId && w.branchId !== main.id)) {
    const found = (
      await json('/api/inventory/serial-numbers', {
        warehouseId: w.id,
        status: 'in_stock',
        limit: '5',
      })
    ).data as (Row & { openTransfer?: unknown })[]
    const free = found.find((s) => !s.openTransfer)
    if (free) return { warehouseId: w.id, serialId: free.id }
  }
  return null
}

async function issue(
  request: APIRequestContext,
  unit: { warehouseId: string; serialId: string },
  reason: string
): Promise<{ id: string; code: string; linkedStockTransfer?: { transferNumber: string } }> {
  const res = await request.post('/api/inventory/uds', {
    data: {
      warehouseId: unit.warehouseId,
      reason,
      notes: `E2E-UDSTRF ${reason}`,
      lines: [{ serialNumberId: unit.serialId }],
    },
  })
  expect(res.ok(), await res.text()).toBe(true)
  return res.json()
}

test.describe('UDS — hops on their own documents', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent = '.tsqd-parent-container { display: none !important; }'
        document.head.appendChild(style)
      })
    })
  })

  test('a repair ticket at a branch opens its own transfer instead of Send to Main', async ({
    page,
    request,
  }) => {
    const unit = await branchUnit(request)
    test.skip(!unit, 'no free in-stock serial at a branch')
    const uds = await issue(request, unit!, 'repair')
    const transferNumber = uds.linkedStockTransfer?.transferNumber
    expect(transferNumber).toBeTruthy()
    try {
      await gotoReady(page, '/inventory/uds')
      const row = page.locator('tbody tr').filter({ hasText: uds.code })
      await expect(row).toBeVisible({ timeout: 20_000 })
      await expect(row.getByRole('button', { name: 'Send to Main' })).toHaveCount(0)
      await row.getByRole('button', { name: `Open ${transferNumber}` }).click()
      await page.waitForURL(/tab=transfers&transfer=/, { timeout: 20_000 })
      expect(decodeURIComponent(page.url())).toContain(`transfer=${transferNumber}`)
    } finally {
      await request.patch(`/api/inventory/uds/${uds.id}/status`, {
        data: { status: 'cancelled' },
      })
    }
  })

  test('a maintenance ticket closes with one Complete — no status picker', async ({
    page,
    request,
  }) => {
    const unit = await branchUnit(request)
    test.skip(!unit, 'no free in-stock serial at a branch')
    const uds = await issue(request, unit!, 'maintenance')

    await gotoReady(page, '/inventory/uds')
    const row = page.locator('tbody tr').filter({ hasText: uds.code })
    await expect(row).toBeVisible({ timeout: 20_000 })
    await row.getByRole('button', { name: 'Complete', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Complete', exact: true })).toBeVisible()
    // One fixed step: none of the old status cards.
    await expect(page.locator('form').getByText('In Transit', { exact: true })).toHaveCount(0)
    await page.locator('form').getByRole('button', { name: 'Complete', exact: true }).click()
    await expect(page.getByText('Status updated').first()).toBeVisible({ timeout: 10_000 })

    const after = (await (await request.get(`/api/inventory/uds/${uds.id}`)).json()) as {
      status: string
    }
    expect(after.status).toBe('completed')
  })

  test('the provider list keeps only suppliers on file for the unit', async ({ page, request }) => {
    const unit = await branchUnit(request)
    test.skip(!unit, 'no free in-stock serial at a branch')
    const uds = await issue(request, unit!, 'repair')
    try {
      const onFile = (
        await (
          await request.get('/api/inventory/uds/provider-options', {
            params: { serialIds: unit!.serialId },
          })
        ).json()
      ).supplierIds as string[]

      await gotoReady(page, '/inventory/uds')
      const row = page.locator('tbody tr').filter({ hasText: uds.code })
      await expect(row).toBeVisible({ timeout: 20_000 })
      await row.locator('td').first().click()
      await page.getByRole('button', { name: 'Set provider' }).click()
      await expect(page.getByRole('heading', { name: 'Set Repair Provider' })).toBeVisible()
      await page.getByPlaceholder('Search repair provider…').click()
      const options = page.getByTestId('searchable-select-option')
      await expect(options.first()).toBeVisible({ timeout: 10_000 })

      if (onFile.length > 0) {
        // Only the item's own suppliers are offered.
        await expect(options).toHaveCount(onFile.length)
      } else {
        // Nobody on file: every supplier is offered, and the form says why.
        await expect(page.getByText('No supplier is on file for these items')).toBeVisible()
      }
    } finally {
      await request.patch(`/api/inventory/uds/${uds.id}/status`, { data: { status: 'cancelled' } })
    }
  })
})
