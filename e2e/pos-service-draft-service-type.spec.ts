import { test, expect, type Page } from '@playwright/test'
import {
  cancelServiceDraft,
  clickStable,
  fillStable,
  findServiceDraftIdByTitle,
  gotoReady,
  pickFromCustomSelect,
  sweepE2EServiceDrafts,
} from './utils'

const TITLE_PREFIX = 'E2E Service Type — '

// Business Owner (this suite's shared storageState persona) has no session
// branch, so the form's Branch field renders as an editable combobox that
// must be filled before submitting — same requirement the serial-number
// capture spec (pos-service-draft-serial-number.spec.ts) already documents.
async function pickFirstBranch(page: Page): Promise<void> {
  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branch = branches[0]
  if (!branch) throw new Error('No seeded branch found')

  const branchInput = page.getByPlaceholder('Search branch by name…')
  await fillStable(branchInput, branch.name)
  const branchDropdown = page.locator('div.fixed.z-100')
  const branchOption = branchDropdown.getByText(branch.name, { exact: false })
  await expect(branchOption).toBeVisible({ timeout: 10_000 })
  await branchOption.click()
}

// Aircool Closing Gap 6 — "type of service" at job creation, from NIG's
// fixed "Services Offered" catalog. Covers the New Service Job form's new
// Types of Service section (category -> filtered sub-type -> quoted amount),
// its display on the detail view, and the materials auto-suggestion that
// fires for a sub-type literally named after a physical part.
test.describe('POS Service Jobs — Types of Service (Closing Gap 6)', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2EServiceDrafts(request, TITLE_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    for (const id of createdIds) await cancelServiceDraft(request, id)
    createdIds = []
  })

  test('creating a service job with a type of service shows it on the detail view', async ({
    page,
  }) => {
    const title = `${TITLE_PREFIX}${Date.now()}`
    await gotoReady(page, '/pos/service-jobs')
    await clickStable(
      page.getByRole('button', { name: 'New Service Job' }),
      page.getByRole('heading', { name: 'New Service Job' })
    )

    await pickFirstBranch(page)
    await fillStable(page.locator('input[placeholder*="Aircon install"]'), title)

    // Types of Service — no row exists until "Add Service Type" is clicked
    // (deliberately not pre-added, unlike Estimated Materials — see the
    // form's own getDefaultValues comment). "FCU" (General Cleaning)
    // doesn't belong to either electrical-part category, so this
    // deliberately does NOT trigger materials auto-suggestion — that's
    // covered by the second test below.
    await page.getByRole('button', { name: 'Add Service Type' }).click()
    await pickFromCustomSelect(page, 'Select category…', 'General Cleaning')
    await pickFromCustomSelect(page, 'Select sub-type…', 'FCU')
    await fillStable(page.getByPlaceholder('Amount'), '500')

    // Estimated Materials is still required regardless of service types.
    const materialInput = page.getByPlaceholder('Search material by name or SKU…')
    await fillStable(materialInput, 'Universal Remote Control')
    const dropdown = page.locator('div.fixed.z-100')
    const materialOption = dropdown.getByText('Universal Remote Control', { exact: false })
    await expect(materialOption).toBeVisible({ timeout: 10_000 })
    await materialOption.click()

    await expect(async () => {
      await page.getByRole('button', { name: 'Create Service Job' }).click()
      await expect(page.getByText('Service job created').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    const row = page.locator('tr').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 10_000 })
    const id = await findServiceDraftIdByTitle(page.request, title)
    createdIds.push(id)

    await row.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Types of Service')).toBeVisible()
    await expect(page.getByText('General Cleaning')).toBeVisible()
    await expect(page.getByText('FCU')).toBeVisible()
    await expect(page.getByText('500.00').first()).toBeVisible()
  })

  test('picking an electrical-part sub-type auto-suggests a matching materials line', async ({
    page,
  }) => {
    // Fixture item named exactly like a "Replacement of Minor Electrical
    // Part" sub-type, so the auto-suggestion's exact-name match fires.
    // Reused across runs (searched first, only created if missing) so
    // repeated runs don't pile up duplicate "Capacitor" items in the
    // catalog — same rationale as the backend suite's upsert-by-sku fixtures.
    const itemName = 'Capacitor'
    const existingRes = await page.request.get(
      `/api/inventory/items?search=${encodeURIComponent(itemName)}&limit=20`
    )
    const existing = ((await existingRes.json()).data ?? []) as {
      id: string
      name: string
      lifecycle?: string
    }[]
    let item = existing.find((i) => i.name === itemName && i.lifecycle === 'active')

    if (!item) {
      const listRes = await page.request.get('/api/inventory/items?limit=1')
      const baseUnitId = (await listRes.json()).data[0].baseUnit.id
      const sku = `E2E-SVCTYPE-${Date.now()}`
      const createRes = await page.request.post('/api/inventory/items', {
        data: { sku, name: itemName, baseUnitId },
      })
      const created = await createRes.json()
      if (!created?.id) {
        throw new Error(`Failed to create "${itemName}" fixture: ${JSON.stringify(created)}`)
      }
      // New items default to draft (Scenario 16 governance) — push through
      // submit -> confirm-accounting -> approve so it's actually selectable.
      await page.request.post(`/api/inventory/items/${created.id}/submit`)
      await page.request.post(`/api/inventory/items/${created.id}/confirm-accounting`, {
        data: {},
      })
      await page.request.post(`/api/inventory/items/${created.id}/approve`, { data: {} })
      item = { id: created.id, name: itemName }
    }

    const title = `${TITLE_PREFIX}${Date.now()}`
    await gotoReady(page, '/pos/service-jobs')
    await clickStable(
      page.getByRole('button', { name: 'New Service Job' }),
      page.getByRole('heading', { name: 'New Service Job' })
    )

    await pickFirstBranch(page)
    await fillStable(page.locator('input[placeholder*="Aircon install"]'), title)

    // Fill the form's own default (empty) Estimated Materials line first —
    // the auto-suggestion appends a second line rather than replacing this
    // one, and both are required to have a real item before submitting.
    const firstMaterialInput = page.getByPlaceholder('Search material by name or SKU…').first()
    await fillStable(firstMaterialInput, 'Universal Remote Control')
    const materialDropdown = page.locator('div.fixed.z-100')
    await expect(
      materialDropdown.getByText('Universal Remote Control', { exact: false })
    ).toBeVisible({ timeout: 10_000 })
    await materialDropdown.getByText('Universal Remote Control', { exact: false }).click()

    await page.getByRole('button', { name: 'Add Service Type' }).click()
    await pickFromCustomSelect(page, 'Select category…', 'Replacement of Minor Electrical Part')
    await pickFromCustomSelect(page, 'Select sub-type…', 'Capacitor')
    await fillStable(page.getByPlaceholder('Amount'), '350')

    // The auto-suggested materials line should appear on its own, in a new
    // "Line 2" row whose Material combobox already shows "Capacitor" —
    // without the cashier ever touching that field. Scoped to the row
    // itself: once a combobox has a value, SearchCombobox's own placeholder
    // attribute becomes that value (see its `placeholder={confirmedLabel ||
    // placeholder || ...}` logic), so a generic getByPlaceholder search
    // stops matching either filled row at this point — row-scoping by the
    // "Line 2" label avoids relying on a placeholder that's no longer there.
    const line2Row = page
      .locator('div.rounded-lg.border.border-zinc-200.bg-zinc-50')
      .filter({ hasText: 'Line 2' })
    const autoSuggestedMaterialInput = line2Row.getByRole('textbox').first()
    await expect(autoSuggestedMaterialInput).toHaveValue(itemName, { timeout: 10_000 })

    await expect(async () => {
      await page.getByRole('button', { name: 'Create Service Job' }).click()
      await expect(page.getByText('Service job created').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    const row = page.locator('tr').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 10_000 })
    const id = await findServiceDraftIdByTitle(page.request, title)
    createdIds.push(id)

    await row.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    // The auto-suggested line was carried through to the saved draft.
    await expect(page.getByText(itemName).first()).toBeVisible()
  })
})
