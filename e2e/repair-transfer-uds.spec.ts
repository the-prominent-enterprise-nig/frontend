import path from 'path'
import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 07 (Repair Transfer) — Part 1: UnitDocumentSheet extended with an
// RFS-form file attachment and a repair provider (reused Supplier), plus a
// searchable Units serial picker (SearchableSelect over the already-loaded
// in-stock serials, replacing the plain <select>). No UDS delete endpoint
// exists (same tradeoff inventory-stock-adjustment.spec.ts accepts for
// adjustment fixtures), so the created record is left in place — which means
// on repeat runs the list table already has a "Repair Provider" column header
// by the time the modal opens. Every locator below is scoped to the modal's
// own <form> (the only <form> on this page) so it never collides with that
// header or with the underlying "Issue UDS" open button.
test.describe('Repair Transfer — Issue UDS with RFS form + repair provider', () => {
  test('Business Owner issues a repair UDS with an RFS form and repair provider', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/uds')

    const modalHeading = page.getByRole('heading', { name: 'Issue Unit Document Sheet' })
    await clickStable(page.getByRole('button', { name: 'Issue UDS' }), modalHeading)

    const form = page.locator('form')

    // Reason defaults to "repair" — the Repair Provider / RFS Form fields
    // should already be visible without touching the Reason select. Both
    // labels render with a trailing "(optional)" span, so this can't use
    // exact text matching — the `form` scope alone is enough to avoid
    // colliding with the list table's "Repair Provider" column header.
    const repairProviderSelect = form.getByText('Repair Provider').locator('..').locator('select')
    // The file <input> itself is visually hidden (className="hidden") behind
    // a styled, clickable <label> — assert the label, not the input, is
    // visible; setInputFiles works on a hidden input regardless.
    const rfsFileInput = form.getByText('RFS Form').locator('..').locator('input[type="file"]')
    await expect(repairProviderSelect).toBeVisible()
    await expect(form.getByText('Attach supporting document')).toBeVisible()

    const warehouseSelect = form
      .getByText('Warehouse', { exact: true })
      .locator('..')
      .locator('select')
    await warehouseSelect.selectOption({ index: 1 })

    // Units' serial picker is a SearchableSelect (type-ahead over the
    // already-loaded in-stock serials), not a native <select> — open it,
    // narrow by typing a substring of the first option's own label, and
    // confirm the list actually filters down before picking it.
    const serialInput = form.locator('input[placeholder="Search serial number…"]')
    const serialCombobox = serialInput.locator('..').locator('..')
    await serialInput.click()
    const firstOption = serialCombobox.locator('button').first()
    await expect(firstOption).toBeVisible({ timeout: 10_000 })
    const optionCountBeforeSearch = await serialCombobox.locator('button').count()
    const searchTerm = (await firstOption.innerText()).slice(0, 6)

    await serialInput.fill(searchTerm)
    await expect(async () => {
      const count = await serialCombobox.locator('button').count()
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThanOrEqual(optionCountBeforeSearch)
    }).toPass({ timeout: 5_000 })
    for (const text of await serialCombobox.locator('button').allInnerTexts()) {
      expect(text.toLowerCase()).toContain(searchTerm.toLowerCase())
    }
    await serialCombobox.locator('button').first().click()

    await repairProviderSelect.selectOption({ index: 1 })
    const providerLabel = await repairProviderSelect.locator('option:checked').innerText()
    const providerName = providerLabel.split('—').slice(1).join('—').trim()

    await rfsFileInput.setInputFiles(path.join(__dirname, 'fixtures', 'rfs-form-sample.txt'))
    await expect(form.getByText('rfs-form-sample.txt')).toBeVisible({ timeout: 10_000 })

    await expect(async () => {
      await form.getByRole('button', { name: 'Issue UDS' }).click()
      await expect(page.getByText('UDS issued').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    await expect(modalHeading).toBeHidden({ timeout: 10_000 })

    // Newest UDS sorts first (list orders by createdAt desc) — verify the row
    // shows the selected repair provider and an RFS-attached indicator.
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toContainText(providerName, { timeout: 10_000 })
    await expect(firstRow.locator('svg.lucide-paperclip')).toBeVisible()
  })
})
