import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, loginAs, clickStable } from './utils'

// Aircool Closing Gap 3 — POS Service Jobs "Check Stock & Source": preview a
// draft's material shortfall against on-hand stock (GET .../stock-check),
// then confirm to raise a Purchase Request for the shortfall and move the
// job draft -> sourcing (POST .../source). Also covers the role gate — this
// action is Stock-Controller-scoped, deliberately excluding Cashier even
// though Cashier already has create/edit/cancel on drafts.

async function createServiceJob(page: import('@playwright/test').Page, title: string) {
  await gotoReady(page, '/pos/service-jobs')
  await clickStable(
    page.getByRole('button', { name: 'New Service Job' }),
    page.getByRole('heading', { name: 'New Service Job' })
  )

  // Business Owner has no session branch, so the Branch field renders as an
  // editable combobox (branch-scoped roles like Cashier get it pre-locked
  // instead — see ServiceJobFormModal's lockedBranch prop) and the backend
  // 400s without one. Only fill it in when it's actually present.
  const branchInput = page.getByPlaceholder('Search branch by name…')
  if (await branchInput.isVisible().catch(() => false)) {
    await branchInput.click()
    const branchDropdown = page.locator('div.fixed.z-100')
    await expect(branchDropdown.locator('button').first()).toBeVisible({ timeout: 10_000 })
    await branchDropdown.locator('button').first().click()
  }

  await fillStable(page.locator('input[placeholder*="Aircon install"]'), title)

  // Search a specific, stable base-seed item (600 pairs seeded, never
  // touched by this repo's own E2E-* fixtures) rather than taking whichever
  // material the combobox returns first — an unfiltered "first result" can
  // land on another spec's own E2E fixture item, whose stock this repo's
  // test suites intentionally mutate/deplete across runs. The huge estimated
  // qty below still guarantees a shortfall regardless of which item this is.
  const materialInput = page.getByPlaceholder('Search material by name or SKU…')
  await fillStable(materialInput, 'Split-Type Aircon')
  const dropdown = page.locator('div.fixed.z-100')
  // The dropdown fetches on open with whatever query is current at that
  // instant (starts as '' before the 300ms debounce settles), so its first
  // button can briefly be a stale, unfiltered result — match on the option's
  // own text instead of trusting "first button" to already be our search hit.
  const aircondOption = dropdown.getByText('Split-Type Aircon', { exact: false })
  await expect(aircondOption).toBeVisible({ timeout: 10_000 })
  await aircondOption.click()

  await fillStable(page.getByPlaceholder('0'), '100000')

  await expect(async () => {
    await page.getByRole('button', { name: 'Create Service Job' }).click()
    await expect(page.getByText('Service job created successfully').first()).toBeVisible({
      timeout: 3_000,
    })
  }).toPass({ timeout: 15_000 })

  const row = page.locator('tr').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 10_000 })
  return row
}

test.describe('POS Service Jobs — Sourcing (Aircool Closing Gap 3)', () => {
  test('Business Owner previews a shortfall, confirms sourcing, and sees the linked Purchase Request', async ({
    page,
  }) => {
    const title = `E2E Sourcing — ${Date.now()}`
    const row = await createServiceJob(page, title)

    const detailHeading = page.getByRole('heading', { name: title })
    await row.click()
    await expect(detailHeading).toBeVisible()

    const sourceButton = page.getByRole('button', { name: 'Check Stock & Source' })
    const sourcingHeading = page.getByRole('heading', { name: 'Check Stock & Source' })
    await clickStable(sourceButton, sourcingHeading)

    // Preview: the huge estimated qty guarantees a shortfall row.
    await expect(
      page.getByText('A Purchase Request will be raised for the shortfall line(s) above.')
    ).toBeVisible({ timeout: 10_000 })

    await expect(async () => {
      await page.getByRole('button', { name: 'Confirm & Source' }).click()
      await expect(page.getByText('Sourcing confirmed').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    // Sourcing modal closes; detail modal underneath now reflects the
    // result. The list row behind it also shows the same status badge, so
    // this can resolve to more than one match — .first() is enough proof.
    await expect(detailHeading).toBeVisible()
    await expect(page.getByText('sourcing', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Purchase Requests Raised')).toBeVisible()
    await expect(page.getByText('Purchase Order').first()).toBeVisible()

    // "Check Stock & Source" is a draft-only action — it must not reappear
    // once the job has moved past draft.
    await expect(sourceButton).toHaveCount(0)
  })
})

test.describe('POS Service Jobs — Cashier cannot source (role gate)', () => {
  // Cashier already has create/edit/cancel on drafts (unlike this suite's
  // other role-gate specs, no fresh permission is being introduced for
  // Cashier here) — this proves the NEW sourcing action deliberately did not
  // extend to them, per the confirmed Stock-Controller-only scope.
  test.use({ storageState: { cookies: [], origins: [] } })

  const CASHIER_EMAIL = process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com'
  const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

  test('Cashier sees Edit/Cancel on their own draft but never Check Stock & Source', async ({
    page,
  }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)

    const title = `E2E Sourcing — Cashier — ${Date.now()}`
    const row = await createServiceJob(page, title)

    const detailHeading = page.getByRole('heading', { name: title })
    await row.click()
    await expect(detailHeading).toBeVisible()

    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check Stock & Source' })).toHaveCount(0)
  })
})
