import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, pickComboboxOption } from './utils'

// Covers the two pieces of the UDS screen that replaced a dropdown and a
// hint-per-field trail: the status band (server-side counts, click to filter)
// and the document trail's due/pending split (only legs the unit has actually
// passed are called outstanding).
//
// Like repair-transfer-uds.spec.ts, this reads whatever the seeded DB happens
// to hold rather than creating its own sheets — the assertions below are all
// invariants that hold for any data, so nothing here depends on a particular
// fixture existing, and nothing is left behind.

// Exactly UDS_STATUS_LABELS, minus cancelled — which is not a stage.
const PIPELINE_LABELS = [
  'Issued',
  'In Transit',
  'Received',
  'At Service Centre',
  'Repaired',
  'Completed',
]

function bandTile(page: Page, label: string) {
  return page
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${label}`) })
    .first()
}

/** The list settles on either a row or its own empty state — a bare row count
 *  can't tell "still loading" from "loaded, nothing here". */
async function waitForList(page: Page): Promise<void> {
  await expect(async () => {
    const rows = await page.locator('tbody tr').count()
    if (rows > 0) return
    expect(await page.getByText('No Unit Document Sheets found').isVisible()).toBe(true)
  }).toPass({ timeout: 15_000 })
}

/**
 * The seeded DB carries no UDS records, and both assertions below need at
 * least one. Issues the simplest possible sheet — a repair with one unit, no
 * provider and no RFS form — and leaves it in place, exactly as
 * repair-transfer-uds.spec.ts does (there is no UDS delete endpoint).
 */
async function ensureOneUds(page: Page): Promise<void> {
  if ((await page.locator('tbody tr').count()) > 0) return

  const modalHeading = page.getByRole('heading', { name: 'Issue Unit Document Sheet' })
  await clickStable(page.getByRole('button', { name: 'Issue UDS' }), modalHeading)

  const form = page.locator('form')
  // Business Owner is not branch-scoped, so Location is a live type-ahead
  // rather than the locked single-option one a Branch Manager sees.
  const location = form.getByPlaceholder('Search location…')
  if (await location.isEnabled()) await pickComboboxOption(page, 'Search location…')

  const serialInput = form.locator('input[placeholder="Search serial number…"]')
  await serialInput.click()
  // Portalled to <body>, so not reachable by walking up from the input.
  const firstOption = page.getByTestId('searchable-select-option').first()
  await expect(firstOption).toBeVisible({ timeout: 10_000 })
  await firstOption.click()

  await form.getByRole('button', { name: 'Issue UDS' }).click()
  await expect(page.getByText('UDS issued').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('tbody tr')).not.toHaveCount(0, { timeout: 10_000 })
}

test.describe('UDS status band', () => {
  test('shows a tile per stage, each with a settled count', async ({ page }) => {
    await gotoReady(page, '/inventory/uds')
    await waitForList(page)

    for (const label of PIPELINE_LABELS) {
      const tile = bandTile(page, label)
      await expect(tile).toBeVisible()
      // The count arrives from its own query, so it starts as a skeleton.
      await expect(tile.locator('span.font-mono')).toHaveText(/^\d+$/, { timeout: 15_000 })
    }

    // Cancelled is not a stage and earns a tile only when it has sheets in it.
    const cancelled = page.getByRole('button').filter({ hasText: /^Cancelled/ })
    const cancelledCount = await cancelled.count()
    expect(cancelledCount === 0 || cancelledCount === 1).toBe(true)
  })

  test('clicking a stage filters the list, and clicking it again clears', async ({ page }) => {
    await gotoReady(page, '/inventory/uds')
    await waitForList(page)
    await ensureOneUds(page)

    // Drive whichever stage actually has sheets — the seed makes no promises.
    let chosen: string | null = null
    for (const label of PIPELINE_LABELS) {
      const text = await bandTile(page, label).locator('span.font-mono').innerText()
      if (Number(text) > 0) {
        chosen = label
        break
      }
    }
    expect(chosen).not.toBeNull()

    // Not clickStable: that helper retries by clicking again, and a band tile
    // *toggles* its filter on every click — a retry would switch it straight
    // back off. Same reason openCustomSelect() avoids it.
    const tile = bandTile(page, chosen as string)
    await tile.click()
    await expect(tile).toHaveAttribute('aria-pressed', 'true')

    // Every row that survives the filter carries the stage that was clicked.
    await expect(async () => {
      const rows = page.locator('tbody tr')
      const count = await rows.count()
      expect(count).toBeGreaterThan(0)
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i)).toContainText(chosen as string)
      }
    }).toPass({ timeout: 15_000 })

    await tile.click()
    await expect(tile).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('UDS document trail', () => {
  test('names only the documents the unit is actually past, and drops the per-leg hints', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/uds')
    await waitForList(page)
    await ensureOneUds(page)

    const row = page.locator('tbody tr').first()
    // The list's own count, before opening anything — 0 when the chip is absent.
    const chip = row.getByText(/\d+ outstanding/)
    const listCount = (await chip.count()) ? Number((await chip.innerText()).split(' ')[0]) : 0

    // The Route cell carries a link to the auto-paired stock transfer, and a
    // row-centre click lands on it and navigates away. The Document cell is
    // the only one with nothing clickable of its own.
    // exact, or it also matches the page's own "Unit Document Sheets" h1.
    const modal = page.getByRole('heading', { name: 'Unit Document Sheet', exact: true })
    await clickStable(row.locator('td').first(), modal)

    // The trail's badge is the same number the row reported. This is the whole
    // point of the change: the two are one count, derived once.
    // Scoped to the trail card's own header — the row's chip says the same
    // thing and is still in the DOM behind the modal, so an unscoped lookup
    // would compare the row against itself.
    const badge = page
      .getByText('Document trail')
      .locator('..')
      .getByText(/^(\d+ outstanding|Complete)$/)
    await expect(badge).toBeVisible()
    const badgeText = await badge.innerText()
    const badgeCount = badgeText === 'Complete' ? 0 : Number(badgeText.split(' ')[0])
    expect(badgeCount).toBe(listCount)

    // A leg with no number is either overdue ("Not recorded", amber) or simply
    // not reached yet, in which case it says nothing at all. The hint copy that
    // used to print under every empty leg is gone.
    for (const hint of [
      'The gate pass the unit travels on',
      'Raised by the branch alongside the handover',
      'Handed out with the unit',
      'Proof of purchase shown at intake',
    ]) {
      await expect(page.getByText(hint)).toHaveCount(0)
    }

    // And the count is exactly the number of legs flagged as not recorded.
    await expect(page.getByText('Not recorded')).toHaveCount(badgeCount)
  })

  test('a leg the unit has passed becomes outstanding; one ahead of it stays quiet', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/uds')
    await waitForList(page)
    await ensureOneUds(page)

    // A freshly issued sheet is past nothing, so nothing is overdue yet —
    // this is the half of the change that stops empty legs reading as gaps.
    const row = page.locator('tbody tr').filter({ hasText: 'Issued' }).first()
    await expect(row).toBeVisible()
    await expect(row.getByText(/\d+ outstanding/)).toHaveCount(0)

    // Send it to main. The gate pass and the SI that should travel with it
    // are now behind the unit, and neither has a number against it.
    const statusModal = page.getByRole('heading', { name: 'Update UDS Status' })
    await clickStable(row.getByRole('button', { name: 'Send to Main' }), statusModal)
    const form = page.locator('form')
    await form.getByText('In Transit', { exact: true }).click()
    await form.getByRole('button', { name: 'Update Status' }).click()
    await expect(page.getByText('Status updated').first()).toBeVisible({ timeout: 10_000 })

    const moved = page.locator('tbody tr').filter({ hasText: 'In Transit' }).first()
    await expect(moved.getByText(/\d+ outstanding/)).toBeVisible({ timeout: 15_000 })

    const modal = page.getByRole('heading', { name: 'Unit Document Sheet', exact: true })
    await clickStable(moved.locator('td').first(), modal)

    // Named, and amber, because the unit is past them.
    await expect(page.getByText('Gate pass out')).toBeVisible()
    await expect(page.getByText('Not recorded').first()).toBeVisible()

    // Still ahead of the unit, so still silent — present as a label, with no
    // "Not recorded" of its own.
    await expect(page.getByText('DR to provider')).toBeVisible()
    const badge = page
      .getByText('Document trail')
      .locator('..')
      .getByText(/^(\d+ outstanding|Complete)$/)
    const count = Number((await badge.innerText()).split(' ')[0])
    expect(count).toBeGreaterThan(0)
    await expect(page.getByText('Not recorded')).toHaveCount(count)
  })
})
