import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 61 Part 3 — the Daily Sales Monitoring sheet, the second tab on the
 * Daily Collection page.
 *
 * Read-only: opens a branch from the owner's roll-up, switches to the sales
 * tab and checks the sheet reproduces the client's form — the category
 * table and the two cuts that tie to total sales. No sign-offs: those are
 * the collection report's. Nothing is created, so there is nothing to clean up.
 *
 * Unlike the collection report, the owner sees this sheet whether or not the
 * branch has filed its Daily Collection form.
 *
 * Figures and their tie-outs are covered by
 * backend/test/daily-sales-monitoring.e2e-spec.ts.
 */
test.describe('POS — Daily Sales Monitoring sheet', () => {
  test('switches to the sales sheet and lays it out like the paper form', async ({ page }) => {
    await gotoReady(page, '/pos/daily-collection')

    await page.getByRole('button', { name: 'Bago', exact: true }).first().click()
    const salesTab = page.getByRole('tab', { name: 'Sales monitoring' })
    await expect(salesTab).toBeVisible()
    await salesTab.click()

    await expect(
      page.getByRole('heading', { name: 'Daily Sales & Collection Monitoring' })
    ).toBeVisible()
    await expect(salesTab).toHaveAttribute('aria-selected', 'true')

    // No "Not submitted yet" here: the owner reads this sheet before the
    // branch files.
    await expect(page.getByRole('heading', { name: 'Not submitted yet' })).toHaveCount(0)
    const sheet = page.locator('.print-sheet')
    await expect(sheet).toBeVisible()
    // Sales only — the collections are the Daily Collection Report's.
    await expect(sheet.getByText('For accounting', { exact: false })).toHaveCount(0)

    // Text is uppercased by CSS, so match the DOM text, not the rendering.
    for (const label of [
      'For sales · per category',
      'Appliances',
      'Furniture',
      '3E',
      'Non-3E',
      'Small items',
      'IT products',
      'Computers, laptops & accessories',
      'Cellphones',
      'Split type',
      'Total sales',
      'By channel',
      'Office sales',
      'Agent sales',
      'By invoice type',
      'Cash invoice (COD)',
      'Charge invoice',
    ]) {
      await expect(sheet.getByText(label, { exact: true })).toBeVisible()
    }
    // No sign-offs on this sheet — Prepared by / Checked by are the
    // collection report's.
    await expect(sheet.getByText('Equals total sales', { exact: true })).toHaveCount(0)
    await expect(sheet.getByText('Prepared by', { exact: false })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()

    // Back to the collection report: the tab switch is a view change, not a
    // navigation, so the ledger is one click away.
    await page.getByRole('tab', { name: 'Collection report' }).click()
    await expect(page.getByRole('heading', { name: 'Daily Collection Report' })).toBeVisible()
  })

  /**
   * The sheet is one narrow column, so it is taller than a two-column layout
   * would be — this guards the thing that buys back: the print fitter must
   * still scale it onto a single page of every paper the dialog offers.
   */
  test('fits on one page for letter, A4 and legal', async ({ page }) => {
    await gotoReady(page, '/pos/daily-collection')
    await page.getByRole('button', { name: 'Bago', exact: true }).first().click()
    await page.getByRole('tab', { name: 'Sales monitoring' }).click()
    await expect(
      page.getByRole('heading', { name: 'Daily Sales & Collection Monitoring' })
    ).toBeVisible()

    const measure = async (): Promise<{ paper: string; mm: number; limitMm: number }[] | null> =>
      page.evaluate(() => {
        const MM_PX = 96 / 25.4
        // Landscape inner heights, mirroring PAPERS in DailyCollectionPrintPages.
        const papers = [
          { key: 'letter', h: 215.9, inset: 2 },
          { key: 'a4', h: 210, inset: 0 },
          { key: 'legal', h: 215.9, inset: 0 },
        ]
        const el = Array.from(document.querySelectorAll<HTMLElement>('.print-fit')).find((n) =>
          n.textContent?.includes('Daily Sales & Collection Monitoring')
        )
        if (!el) return null
        const vars = getComputedStyle(el)
        const widths = papers.map((p) => vars.getPropertyValue(`--w-${p.key}`).trim())
        const zooms = papers.map((p) => Number(vars.getPropertyValue(`--z-${p.key}`)))
        if (widths.some((w) => !w) || zooms.some((z) => !z)) return null

        const keepWidth = el.style.width
        const keepZoom = el.style.zoom
        const out = papers.map((p, i) => {
          el.style.width = widths[i]
          el.style.zoom = '1'
          return {
            paper: p.key,
            mm: (el.offsetHeight * zooms[i]) / MM_PX,
            limitMm: p.h - 2 * p.inset,
          }
        })
        el.style.width = keepWidth
        el.style.zoom = keepZoom
        return out
      })

    // The fitter runs again once fonts settle, so the first read can be early.
    await expect.poll(measure, { timeout: 15_000 }).not.toBeNull()
    const fitted = await measure()
    expect(fitted).not.toBeNull()
    for (const { paper, mm, limitMm } of fitted ?? []) {
      expect(mm, `${paper}: sheet is ${mm.toFixed(1)}mm of ${limitMm}mm`).toBeLessThanOrEqual(
        limitMm
      )
    }
  })
})
