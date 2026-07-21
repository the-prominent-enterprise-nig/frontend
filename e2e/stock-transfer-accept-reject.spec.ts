import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 06, Part 3 — source-branch accept/reject of an incoming request,
// then dispatch/receive through to the auto-issued receiving report (GRN).
// Runs entirely as Business Owner (unrestricted across every step in this
// flow per the project's role hierarchy), so there's no need to juggle a
// second login the way the backend e2e spec juggles per-branch managers.

async function ensureHqApprovalOff(page: import('@playwright/test').Page) {
  await gotoReady(page, '/settings/business-policies')
  const toggle = page.getByRole('switch', {
    name: 'Require HQ approval for inter-branch transfers',
  })
  await expect(toggle).toBeVisible()

  const current = (await toggle.getAttribute('aria-checked')) === 'true'
  if (!current) return

  await expect(async () => {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 2_000 })
  }).toPass({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Business policies updated')).toBeVisible({ timeout: 10_000 })
}

async function createBulkRequest(page: import('@playwright/test').Page, uniqueReason: string) {
  await gotoReady(page, '/inventory/transfers')
  await clickStable(
    page.getByRole('button', { name: 'New Transfer' }),
    page.getByRole('heading', { name: 'New Stock Transfer Request' })
  )

  const modalForm = page.locator('form')
  await modalForm.locator('select').nth(0).selectOption({ index: 1 })
  await modalForm.locator('select').nth(1).selectOption({ index: 1 })

  // TN-FAN-001 (Electric Stand Fan) — a real seeded, non-serial-tracked
  // catalog item, so this stays a plain bulk request (mirrors the Part 2 spec).
  const itemInput = page.getByPlaceholder('Search item')
  await itemInput.click()
  await itemInput.fill('TN-FAN-001')
  const option = page.getByRole('button', { name: /TN-FAN-001/ }).first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()

  await page.getByPlaceholder('e.g. Rebalancing stock for upcoming campaign').fill(uniqueReason)

  await expect(async () => {
    await page.getByRole('button', { name: 'Submit Request' }).click()
    await expect(page.getByRole('heading', { name: 'New Stock Transfer Request' })).toHaveCount(0, {
      timeout: 3_000,
    })
  }).toPass({ timeout: 15_000 })
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

// This dev DB accumulates leftover Draft/In-Transit rows from prior test
// runs, so unscoped button/text queries can match the list (behind the
// modal) as well as the modal itself. Scoping everything to the modal's own
// root avoids that ambiguity regardless of how many other rows share a
// status — more robust here than relying on `.last()`.
function detailModal(page: import('@playwright/test').Page) {
  return page.locator('.fixed.inset-0.z-50')
}

test.describe('Inventory — Stock Transfer accept/reject + receiving report', () => {
  test('accept -> dispatch -> receive issues a receiving report (GRN)', async ({ page }) => {
    await ensureHqApprovalOff(page)

    const uniqueReason = `E2E-TRF-AR-HAPPY-${Date.now()}`
    await createBulkRequest(page, uniqueReason)
    await openMine(page, uniqueReason)
    const modal = detailModal(page)

    await expect(modal.getByText('Requested', { exact: true })).toBeVisible()
    await modal.getByRole('button', { name: 'Accept' }).click()
    await expect(modal.getByText('Accepted', { exact: true })).toBeVisible({ timeout: 10_000 })

    await clickStable(
      modal.getByRole('button', { name: 'Dispatch' }),
      modal.getByRole('button', { name: 'Confirm Dispatch' })
    )
    await modal.getByRole('button', { name: 'Confirm Dispatch' }).click()
    await expect(modal.getByText('In Transit', { exact: true })).toBeVisible({ timeout: 10_000 })

    await clickStable(
      modal.getByRole('button', { name: 'Mark Received' }),
      modal.getByRole('button', { name: 'Confirm Receipt' })
    )
    await modal.getByRole('button', { name: 'Confirm Receipt' }).click()
    await expect(modal.getByText('Received', { exact: true })).toBeVisible({ timeout: 10_000 })

    await expect(modal.getByText('Receiving Report Issued')).toBeVisible()
    await expect(modal.getByText(/^GRN-\d{8}-\d{4}$/)).toBeVisible()

    await modal.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('source branch can reject an incoming request, with a reason', async ({ page }) => {
    await ensureHqApprovalOff(page)

    const uniqueReason = `E2E-TRF-AR-REJECT-${Date.now()}`
    await createBulkRequest(page, uniqueReason)
    await openMine(page, uniqueReason)
    const modal = detailModal(page)

    await expect(modal.getByText('Requested', { exact: true })).toBeVisible()
    await modal.getByRole('button', { name: 'Reject' }).click()
    const rejectionReason = 'E2E rejection reason — source branch cannot spare this item right now'
    await modal.getByPlaceholder('Why is this request being rejected?').fill(rejectionReason)
    await modal.getByRole('button', { name: 'Confirm Rejection' }).click()

    await expect(modal.getByText('Rejected', { exact: true })).toBeVisible({ timeout: 10_000 })
    // exact: true — otherwise this also substring-matches the ledger
    // timeline's "Rejected by source branch — <name>" entry.
    await expect(modal.getByText('Rejected by Source Branch', { exact: true })).toBeVisible()
    await expect(modal.getByText(rejectionReason)).toBeVisible()

    await modal.getByRole('button', { name: 'Close dialog' }).click()
  })
})
