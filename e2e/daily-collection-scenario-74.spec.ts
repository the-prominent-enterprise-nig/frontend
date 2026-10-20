import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 74 Part 2 — Daily Collection (client notes, 2026-10-16):
//  - "Do not display the undeposited amount": the UNDEPOSITED credit line is
//    gone from the screen, but stays on the printed form (and the Excel export,
//    which is built server-side and unchanged) — Kian, 2026-10-19.
//  - "Make the daily collection report printable": the all-branches roll-up,
//    which is what an owner opens by default, now has a Print button.
// Case IDs (S74-2-F…) match docs/scenario-74-oct16-client-notes-quick-wins-plan.md.
//
// Ringing a cash day into the dev DB just for this would put test sales on a
// real branch's form, so the ledger cases look for a day that already has
// undeposited cash (any branch, last 21 days) and skip with a note when there
// is none — the suite's convention for a missing fixture.

type Credit = { label: string; bankName: string | null; amount: number }
type Report = { withheld?: boolean; credits?: Credit[]; branchName: string }
type Branch = { id: string; name: string }

async function findUndepositedDay(
  request: APIRequestContext
): Promise<{ date: string; branch: Branch } | null> {
  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ??
    []) as Branch[]
  const today = new Date()
  for (let back = 0; back < 21; back++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
    const rollup = await (
      await request.get(`/api/pos/reports/daily-collection/branches?date=${date}`)
    ).json()
    const trading = ((rollup.data ?? rollup).branches ?? []) as {
      branchId: string
      entryCount: number
      filed: boolean
    }[]
    for (const row of trading.filter((b) => b.entryCount > 0)) {
      const res = await request.get(
        `/api/pos/reports/daily-collection?date=${date}&branchId=${row.branchId}`
      )
      if (!res.ok()) continue
      const body = await res.json()
      const report = (body.data ?? body) as Report
      if (report.withheld) continue
      if ((report.credits ?? []).some((c) => !c.bankName && c.amount > 0)) {
        const branch = branches.find((b) => b.id === row.branchId)
        return { date, branch: branch ?? { id: row.branchId, name: report.branchName } }
      }
    }
  }
  return null
}

/** Cells reading exactly `text`, split by whether they sit in the print copy. */
async function countCells(page: Page, text: string) {
  return page.evaluate((t) => {
    const cells = Array.from(document.querySelectorAll('td')).filter(
      (td) => td.textContent?.trim() === t
    )
    return {
      screen: cells.filter((td) => !td.closest('.print-region')).length,
      print: cells.filter((td) => td.closest('.print-region')).length,
    }
  }, text)
}

test.describe('Scenario 74 Part 2 — Daily Collection', () => {
  test.describe.configure({ mode: 'serial' })

  let day: { date: string; branch: Branch } | null = null

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext({
      baseURL,
      storageState: 'e2e/.auth/business-owner.json',
    })
    day = await findUndepositedDay(request)
    await request.dispose()
  })

  async function openDay(page: Page) {
    const { date, branch } = day!
    const q = new URLSearchParams({
      date,
      branchId: branch.id,
      branchName: branch.name,
      view: 'collection',
    })
    await gotoReady(page, `/pos/daily-collection?${q}`)
    // The ledger, not a "not submitted" notice or a skeleton.
    await expect(page.getByText('Collection receipts').first()).toBeVisible({ timeout: 30_000 })
  }

  test('S74-2-F01 — a day with undeposited cash shows no UNDEPOSITED line on screen', async ({
    page,
  }, testInfo) => {
    if (!day) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'No visible day with undeposited cash in the last 21 days on this DB.',
      })
      return
    }
    await openDay(page)
    await expect.poll(async () => (await countCells(page, 'UNDEPOSITED')).screen).toBe(0)
    // Cards (below lg) render "UNDEPOSITED: …" as text, not a cell.
    await expect(page.getByText(/^UNDEPOSITED:/)).toHaveCount(0)
  })

  test('S74-2-F02 (edge) — the same day’s printed form still carries the UNDEPOSITED line', async ({
    page,
  }, testInfo) => {
    if (!day) {
      testInfo.annotations.push({ type: 'skipped-assertion', description: 'No fixture day.' })
      return
    }
    await openDay(page)
    await expect.poll(async () => (await countCells(page, 'UNDEPOSITED')).print).toBeGreaterThan(0)
  })

  test('S74-2-F03 (edge) — only UNDEPOSITED goes: every DEPOSIT line still shows on screen', async ({
    page,
  }, testInfo) => {
    if (!day) {
      testInfo.annotations.push({ type: 'skipped-assertion', description: 'No fixture day.' })
      return
    }
    await openDay(page)
    await expect.poll(async () => (await countCells(page, 'UNDEPOSITED')).print).toBeGreaterThan(0)
    const deposits = await countCells(page, 'DEPOSIT')
    expect(deposits.screen).toBe(deposits.print)
  })

  test('S74-2-F04 — the all-branches view has a Print button that prints', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __printed: number }).__printed = 0
      window.print = () => {
        ;(window as unknown as { __printed: number }).__printed++
      }
    })
    await gotoReady(page, '/pos/daily-collection')
    // The switcher remembers a branch; the roll-up is "no branch picked".
    const allBranches = page.getByRole('button', { name: '← All branches' })
    if (await allBranches.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await allBranches.click()
    }
    await expect(page.getByRole('heading', { name: 'Branches' })).toBeVisible({ timeout: 30_000 })

    const print = page.getByRole('button', { name: 'Print', exact: true })
    await expect(print).toBeVisible()
    await print.click()
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(
      1
    )
  })

  test('S74-2-F05 (edge) — the roll-up print sheet lists every branch row and the totals', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/daily-collection')
    const allBranches = page.getByRole('button', { name: '← All branches' })
    if (await allBranches.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await allBranches.click()
    }
    await expect(page.getByRole('heading', { name: 'Branches' })).toBeVisible({ timeout: 30_000 })

    const sheet = page.getByTestId('rollup-print-sheet')
    await expect(sheet).toHaveCount(1)
    await expect(sheet).toContainText('Daily Collection Report — All branches')
    await expect(sheet.locator('tfoot')).toContainText('ALL BRANCHES')

    // Same branches, same order, as the on-screen table.
    const screenNames = await page
      .locator('table:not([data-testid]) tbody tr td:first-child button')
      .allTextContents()
    const printNames = await sheet.locator('tbody tr td:first-child').allTextContents()
    expect(printNames.map((s) => s.trim())).toEqual(screenNames.map((s) => s.trim()))
  })
})
