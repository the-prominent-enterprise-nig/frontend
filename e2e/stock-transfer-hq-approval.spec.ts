import { test, expect } from '@playwright/test'
import {
  cancelStockTransfer,
  clickStable,
  findStockTransferIdByReason,
  gotoReady,
  pickComboboxOption,
  sweepE2EStockTransfers,
} from './utils'

const REASON_PREFIX = 'E2E-TRF-HQ-'

// Scenario 06, Part 2 — request/approval states + the HQ-approval toggle
// (My Workspace > Business Policies). Mutates the tenant's real "Require HQ
// approval for inter-branch transfers" setting for its assertions — reads
// the toggle's starting state and restores it at the end so this test
// doesn't leave the setting different for manual testing or other e2e runs.

async function setHqApprovalToggle(page: import('@playwright/test').Page, desired: boolean) {
  await gotoReady(page, '/settings/business-policies')
  const toggle = page.getByRole('switch', {
    name: 'Require HQ approval for inter-branch transfers',
  })
  await expect(toggle).toBeVisible()

  const current = (await toggle.getAttribute('aria-checked')) === 'true'
  if (current === desired) return // already in the desired state — nothing to save

  // Same hydration race fillStable/clickStable work around elsewhere in this
  // app: the toggle's onClick can be un-hydrated for an instant after
  // navigation, silently no-oping the first click.
  await expect(async () => {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', String(desired), { timeout: 2_000 })
  }).toPass({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Business policies updated')).toBeVisible({ timeout: 10_000 })
}

async function createBulkRequest(page: import('@playwright/test').Page, uniqueReason: string) {
  await gotoReady(page, '/inventory/transfers')
  await clickStable(
    page.getByRole('button', { name: 'New Transfer' }),
    page.getByRole('heading', { name: 'New Stock Transfer' })
  )

  // From/To are SearchableSelect comboboxes, not native <select> elements.
  // The destination list already excludes whatever the source is set to, so
  // index 0 of each is a valid distinct pair.
  await pickComboboxOption(page, 'Search source branch…')
  await pickComboboxOption(page, 'Search destination branch…')

  // Resolve a real non-serial-tracked item rather than naming an SKU — this
  // spec used to hardcode TN-FAN-001, which is no longer in the seed.
  // Non-serial keeps this a plain bulk request, with no serial picker to fill.
  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { limit: '100', lifecycle: 'active' },
  })
  const bulkItem = (
    ((await itemsRes.json()).data ?? []) as {
      sku: string
      isSerialTracked: boolean
      isService?: boolean
    }[]
  ).find((i) => !i.isSerialTracked && !i.isService)
  if (!bulkItem) throw new Error('no non-serial-tracked active item found in the catalog')

  // Items are added from the Items card's own "Add item" search. SearchCombobox
  // renders a BUTTON when closed and only swaps in the search <input> once
  // opened, so open it first, then type.
  await page
    .getByRole('button', { name: /Add item/ })
    .first()
    .click()
  const itemInput = page.locator('input[placeholder*="Add item"]')
  await expect(itemInput).toBeVisible({ timeout: 10_000 })
  await itemInput.fill(bulkItem.sku)
  const option = page.getByRole('button', { name: new RegExp(bulkItem.sku) }).first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()

  await page.getByPlaceholder('e.g. Rebalancing stock for upcoming campaign').fill(uniqueReason)

  await expect(async () => {
    await page.getByRole('button', { name: 'Submit Request' }).click()
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toHaveCount(0, {
      timeout: 3_000,
    })
  }).toPass({ timeout: 15_000 })
  // Creation goes through a Server Action, not a client-visible request —
  // look the id up after the fact instead of intercepting the create call.
  return findStockTransferIdByReason(page.request, uniqueReason)
}

async function openMine(page: import('@playwright/test').Page, uniqueReason: string) {
  // Rows are clickable directly now (no more per-row "View" button) — the
  // list doesn't surface the reason text itself, so this still opens the
  // most recent row and verifies/retries rather than filtering by content.
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
}

test.describe('Inventory — Stock Transfer request/approval states & HQ-approval toggle', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2EStockTransfers(request, REASON_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    // No-op for the reject test below — Rejected isn't a cancellable state,
    // same as it was never cleaned up before this change either.
    for (const id of createdIds) await cancelStockTransfer(request, id)
    createdIds = []
  })

  test('toggle off: a new request starts as "Requested" directly', async ({ page }) => {
    await setHqApprovalToggle(page, false)

    const uniqueReason = `E2E-TRF-HQ-OFF-${Date.now()}`
    createdIds.push(await createBulkRequest(page, uniqueReason))
    await openMine(page, uniqueReason)

    // Multiple "Requested" matches exist (list rows, filter option) — the
    // modal's own status badge renders last in DOM order, after the list.
    await expect(page.getByText('Requested', { exact: true }).last()).toBeVisible()
  })

  test('toggle on: Business Owner can approve a request pending HQ review', async ({ page }) => {
    await setHqApprovalToggle(page, true)

    const uniqueReason = `E2E-TRF-HQ-APPROVE-${Date.now()}`
    createdIds.push(await createBulkRequest(page, uniqueReason))
    await openMine(page, uniqueReason)

    await expect(page.getByText('Pending HQ Approval', { exact: true }).last()).toBeVisible()
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText('Requested', { exact: true }).last()).toBeVisible({
      timeout: 10_000,
    })

    await setHqApprovalToggle(page, false)
  })

  test('toggle on: Business Owner can reject a request pending HQ review, with a reason', async ({
    page,
  }) => {
    await setHqApprovalToggle(page, true)

    const uniqueReason = `E2E-TRF-HQ-REJECT-${Date.now()}`
    createdIds.push(await createBulkRequest(page, uniqueReason))
    await openMine(page, uniqueReason)

    await expect(page.getByText('Pending HQ Approval', { exact: true }).last()).toBeVisible()
    await page.getByRole('button', { name: 'Reject' }).click()
    const rejectionReason = 'E2E rejection reason — insufficient stock at destination'
    await page.getByPlaceholder('Why is this request being rejected?').fill(rejectionReason)
    await page.getByRole('button', { name: 'Confirm Rejection' }).click()

    await expect(page.getByText('Rejected', { exact: true }).last()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(rejectionReason)).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
    await setHqApprovalToggle(page, false)
  })
})
