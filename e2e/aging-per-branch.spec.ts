import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 47 Part 4 — Aging of accounts per branch.
 *
 * The report already existed (branch -> collector grouping, AR invoices
 * folded in, dedup); this covers what Part 4 added on top: the branch x
 * aging-bucket matrix and the .xlsx export. Bucket-boundary correctness is
 * covered by the backend suite (backend/test/aging-per-branch.e2e-spec.ts),
 * which controls due dates via direct Prisma writes.
 *
 * The view is reachable two ways — its own CRM page and the accounting
 * Reports hub's "AR Aging" tab — and both render the same component, so
 * testing one covers both.
 *
 * On a freshly reset e2e DB there are no receivables, so the download
 * assertion self-skips with an annotation rather than passing quietly. Seed
 * some first with backend/scripts/s47-e2e-fixture.ts (see the sales spec).
 */

test.describe('CRM — AR Aging per branch (Scenario 47)', () => {
  test('shows the branch x aging bucket matrix', async ({ page }) => {
    await gotoReady(page, '/crm/installment-accounts/aging-report')

    await expect(page.getByRole('heading', { name: 'AR Aging Report' })).toBeVisible({
      timeout: 15_000,
    })

    // The matrix Part 4 added — every bucket is its own column.
    for (const label of ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days']) {
      await expect(page.getByRole('columnheader', { name: label })).toBeVisible({
        timeout: 20_000,
      })
    }

    // An unknown due date must be visible as its own column, never folded
    // into Current.
    await expect(page.getByRole('columnheader', { name: 'Unknown' })).toBeVisible()
  })

  test('detail rows show the bucket that drives the matrix above', async ({ page }) => {
    await gotoReady(page, '/crm/installment-accounts/aging-report')
    await expect(page.getByRole('heading', { name: 'AR Aging Report' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })

    if (await page.getByText('No active accounts to show.').isVisible()) {
      test.info().annotations.push({
        type: 'skipped-assertion',
        description: 'No receivables on record — detail table not rendered.',
      })
      return
    }

    // Source / Aging must exist on screen, not only in the .xlsx Detail sheet —
    // otherwise the matrix says "4,000 in 61-90 days" and nothing on the page
    // says which rows those are.
    await expect(page.getByRole('columnheader', { name: 'Source' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Aging' }).first()).toBeVisible()

    // Both kinds of receivable are labelled.
    await expect(page.getByRole('cell', { name: 'Invoice', exact: true }).first()).toBeVisible()

    // And at least one row carries a real bucket badge.
    await expect(
      page.getByText(/^(Current|1-30 days|31-60 days|61-90 days|90\+ days)$/).first()
    ).toBeVisible()
  })

  test('drops installment-only columns when nothing on the report uses them', async ({ page }) => {
    await gotoReady(page, '/crm/installment-accounts/aging-report')
    await expect(page.getByRole('heading', { name: 'AR Aging Report' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })

    if (await page.getByText('No active accounts to show.').isVisible()) {
      test.info().annotations.push({
        type: 'skipped-assertion',
        description: 'No receivables on record — detail table not rendered.',
      })
      return
    }

    // Term/MI/DP Bal/MI DUE only ever carry values on installment rows. The
    // invariant either way: they are shown exactly when something needs them,
    // never as a column of dashes.
    const hasInstallment =
      (await page.getByRole('cell', { name: 'Installment', exact: true }).count()) > 0
    const expected = hasInstallment ? 1 : 0

    for (const column of ['Term', 'MI', 'DP Bal', 'MI DUE']) {
      expect(
        await page.getByRole('columnheader', { name: column, exact: true }).count()
      ).toBeGreaterThanOrEqual(expected)
      if (!hasInstallment) {
        await expect(page.getByRole('columnheader', { name: column, exact: true })).toHaveCount(0)
      }
    }

    // The columns that apply to both kinds are always there.
    await expect(page.getByRole('columnheader', { name: 'OB', exact: true }).first()).toBeVisible()
  })

  // Pages hold whole branches, packed up to ROWS_PER_PAGE_BUDGET account rows and
  // never more than 10 branches (aging-report/_params.ts) — the old fixed
  // 10-branch page carried 6,000+ rows. So page 1 starts at branch 1 and ends
  // at or before branch 10, and Next starts where the previous page stopped.
  test('paginates branch sections (whole branches, at most 10 per page)', async ({ page }) => {
    await gotoReady(page, '/crm/installment-accounts/aging-report')
    await expect(page.getByRole('heading', { name: 'AR Aging Report' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })

    const showing = page.getByText(/Showing \d+–\d+ of \d+ branch/)
    if (!(await showing.isVisible())) {
      test.info().annotations.push({
        type: 'skipped-assertion',
        description: 'No receivables on record — pagination not rendered.',
      })
      return
    }

    const total = Number((await showing.textContent())!.match(/of (\d+) branch/)![1])
    const pager = page.getByRole('navigation', { name: 'Table pagination' })

    if (total <= 10) {
      await expect(pager).toHaveCount(0)
      return
    }

    const firstPage = (await showing.textContent())!.match(/Showing 1–(\d+) of/)
    expect(firstPage, 'page 1 starts at the first branch').not.toBeNull()
    const firstPageEnd = Number(firstPage![1])
    expect(firstPageEnd).toBeLessThanOrEqual(10)
    await expect(pager.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await pager.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText(new RegExp(`Showing ${firstPageEnd + 1}–`))).toBeVisible()
  })

  test('the summary matrix and grand total always cover every branch', async ({ page }) => {
    await gotoReady(page, '/crm/installment-accounts/aging-report')
    await expect(page.getByRole('heading', { name: 'AR Aging Report' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })

    if (await page.getByText('No active accounts to show.').isVisible()) {
      test.info().annotations.push({
        type: 'skipped-assertion',
        description: 'No receivables on record.',
      })
      return
    }

    // Paging bounds what is rendered below, never what the totals report —
    // a Grand Total that changed when you clicked Next would be worthless.
    const grandTotal = page.getByText(/Grand Total \(\d+ accounts\)/)
    await expect(grandTotal).toBeVisible()
    const before = await grandTotal.textContent()

    const pager = page.getByRole('navigation', { name: 'Table pagination' })
    if ((await pager.count()) > 0) {
      await pager.getByRole('button', { name: 'Next' }).click()
      // Past page 1: the range no longer starts at 1.
      await expect(page.getByText(/Showing (?!1–)\d+–\d+ of \d+ branch/)).toBeVisible()
      await expect(grandTotal).toHaveText(before!)
    }
  })

  test('keeps the existing Print action alongside the new export', async ({ page }) => {
    await gotoReady(page, '/crm/installment-accounts/aging-report')
    await expect(page.getByRole('heading', { name: 'AR Aging Report' })).toBeVisible({
      timeout: 15_000,
    })

    await expect(page.getByRole('button', { name: /Print/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Export to Excel/ })).toBeVisible()
  })

  test('is reachable from the accounting Reports hub too', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=ar-aging')

    await expect(page.getByRole('heading', { name: 'AR Aging Report' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: /Export to Excel/ })).toBeVisible()
  })

  test('Export to Excel downloads a real .xlsx', async ({ page }) => {
    await gotoReady(page, '/crm/installment-accounts/aging-report')
    await expect(page.getByRole('heading', { name: 'AR Aging Report' })).toBeVisible({
      timeout: 15_000,
    })

    const exportButton = page.getByRole('button', { name: /Export to Excel/ })
    await expect(exportButton).toBeVisible()

    // Let the fetch settle before reading the button state — checking too
    // early would silently skip the download this test exists to prove.
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })

    if (await exportButton.isDisabled()) {
      await expect(page.getByText('No active accounts to show.')).toBeVisible()
      test.info().annotations.push({
        type: 'skipped-assertion',
        description: 'No receivables on record — download path not exercised.',
      })
      return
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await exportButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/ar-aging-per-branch.*\.xlsx$/)

    const path = await download.path()
    const { readFileSync } = await import('fs')
    expect(readFileSync(path).subarray(0, 2).toString()).toBe('PK')
  })
})
