import { test, expect } from '@playwright/test'
import {
  cancelServiceDraft,
  clickStable,
  fillStable,
  findServiceDraftIdByTitle,
  gotoReady,
  sweepE2EServiceDrafts,
} from './utils'

const TITLE_PREFIX = 'E2E Serial — '

// Aircool — serial-number capture on Estimated Materials lines: a
// serial-tracked material must have its exact physical unit picked at
// estimate time (not just a quantity), locked to estimatedQty 1. Registers
// its own fresh serial on the seeded dual-serial-capable "Split-Type
// Aircon" item purely as a convenient, already-registered serial-tracked
// fixture (same fixture inventory-adjustment-non-saleable-status.spec.ts
// reuses for its own unrelated purpose) — this flow never touches that
// item's secondary/dual-serial checkout behavior, only the single
// serialNumberId a ServiceDraftLine now supports.
test.describe('POS Service Jobs — Serial Number Capture', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2EServiceDrafts(request, TITLE_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    for (const id of createdIds) await cancelServiceDraft(request, id)
    createdIds = []
  })

  test('creating a service job with a serial-tracked material requires and captures a serial number', async ({
    page,
  }) => {
    const branchesRes = await page.request.get('/api/branches?limit=200')
    const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
    const branch = branches[0]

    const warehousesRes = await page.request.get('/api/inventory/warehouses?limit=200')
    const warehouses = ((await warehousesRes.json()).data ?? []) as {
      id: string
      branchId: string | null
    }[]
    const warehouse = warehouses.find((w) => w.branchId === branch.id)
    if (!warehouse) throw new Error('No warehouse found for the first branch')

    const itemsRes = await page.request.get(
      `/api/inventory/items?search=${encodeURIComponent('Split-Type Aircon')}&limit=20`
    )
    const items = ((await itemsRes.json()).data ?? []) as {
      id: string
      name: string
      isSerialTracked: boolean
    }[]
    const item = items.find((i) => i.name.includes('Split-Type Aircon') && i.isSerialTracked)
    if (!item) throw new Error('Split-Type Aircon fixture item not found')

    const serialNumber = `E2E-SD-SN-${Date.now()}`
    const registerRes = await page.request.post('/api/inventory/serial-numbers', {
      data: { itemId: item.id, warehouseId: warehouse.id, serialNumbers: [serialNumber] },
    })
    if (!registerRes.ok()) {
      throw new Error(`Failed to register serial: ${await registerRes.text()}`)
    }

    const title = `${TITLE_PREFIX}${Date.now()}`
    await gotoReady(page, '/pos/service-jobs')
    await clickStable(
      page.getByRole('button', { name: 'New Service Job' }),
      page.getByRole('heading', { name: 'New Service Job' })
    )

    // Business Owner has no session branch, so Branch renders as an editable
    // combobox — pin it to the same branch the serial was registered at, so
    // the picker below can actually find it.
    const branchInput = page.getByPlaceholder('Search branch by name…')
    if (await branchInput.isVisible().catch(() => false)) {
      await fillStable(branchInput, branch.name)
      const branchDropdown = page.locator('div.fixed.z-100')
      const branchOption = branchDropdown.getByText(branch.name, { exact: false })
      await expect(branchOption).toBeVisible({ timeout: 10_000 })
      await branchOption.click()
    }

    await fillStable(page.locator('input[placeholder*="Aircon install"]'), title)

    // Multiple "Split-Type Aircon ..." variants are seeded — search/match on
    // this exact item's own name (not the shared substring) to land on the
    // same item the serial above was registered against.
    const materialInput = page.getByPlaceholder('Search material by name or SKU…')
    await fillStable(materialInput, item.name)
    const dropdown = page.locator('div.fixed.z-100')
    const materialOption = dropdown.getByText(item.name, { exact: false })
    await expect(materialOption).toBeVisible({ timeout: 10_000 })
    await materialOption.click()

    // Serial-tracked material picked -> Serial Number field appears and
    // Estimated Qty locks to a disabled "1".
    await expect(page.getByText('Serial Number', { exact: false }).first()).toBeVisible()

    // Submitting without picking a serial is blocked with an inline error,
    // not a silent 400 from the backend.
    await page.getByRole('button', { name: 'Create Service Job' }).click()
    await expect(
      page.getByText('Select a serial number for this serial-tracked material').first()
    ).toBeVisible({ timeout: 5_000 })

    const serialInput = page.getByPlaceholder('Search serial number…')
    await fillStable(serialInput, serialNumber)
    const serialDropdown = page.locator('div.fixed.z-100')
    const serialOption = serialDropdown.getByText(serialNumber, { exact: false })
    await expect(serialOption).toBeVisible({ timeout: 10_000 })
    await serialOption.click()

    await expect(async () => {
      await page.getByRole('button', { name: 'Create Service Job' }).click()
      await expect(page.getByText('Service job created successfully').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    const row = page.locator('tr').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 10_000 })
    const id = await findServiceDraftIdByTitle(page.request, title)
    createdIds.push(id)

    // Detail view shows the captured serial alongside the material.
    await row.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText(`SN: ${serialNumber}`)).toBeVisible()
  })
})
