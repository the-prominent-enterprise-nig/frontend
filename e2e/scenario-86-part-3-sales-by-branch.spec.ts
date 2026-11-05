import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

const ROLE_PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

// Scenario 86 Part 3 — Oct 29 UAT POS-01. With "All Branches" picked, the POS
// Overview's Total Sales card is every branch combined; a "Total Sales by
// branch" breakdown now sits under it, and its total equals the card. With
// one branch picked the card is already that branch, so no breakdown.
//
// Works on whatever sales the DB has this month: either branches with sales
// whose total matches the card, or "No sales in this period." with a ₱0 card.
// The exact per-branch figures and branch scoping are covered by the backend
// e2e scenario-86-sales-by-branch.

const STORE_KEY = 'pos-branch-context' // zustand persist key of the branch switcher

async function pickBranch(page: Page, branch: { id: string; name: string } | null) {
  await page.evaluate(
    ([key, b]) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          state: { branchId: b?.id ?? null, branchName: b?.name ?? null },
          version: 0,
        })
      ),
    [STORE_KEY, branch] as const
  )
}

const money = (text: string) => Number(text.replace(/[^\d.-]/g, ''))

test.describe('POS Overview — Total Sales per branch (POS-01)', () => {
  test('All Branches: the breakdown is shown and adds up to the Total Sales card', async ({
    page,
  }) => {
    await gotoReady(page, '/pos')
    await pickBranch(page, null)
    await gotoReady(page, '/pos')

    const card = page.getByTestId('stat-total-sales')
    const breakdown = page.getByTestId('total-sales-by-branch')
    await expect(breakdown).toBeVisible({ timeout: 20_000 })
    await expect(breakdown.getByText('Total Sales by branch')).toBeVisible()
    // Wait for both to finish loading (skeletons gone).
    await expect(card.locator('p.text-2xl')).toBeVisible({ timeout: 20_000 })
    await expect(
      breakdown.getByTestId('total-sales-by-branch-total').or(breakdown.getByText(/No sales/))
    ).toBeVisible({ timeout: 20_000 })

    const cardValue = money(await card.locator('p.text-2xl').innerText())
    const rows = breakdown.getByTestId('total-sales-branch-row')
    if ((await rows.count()) === 0) {
      await expect(breakdown.getByText('No sales in this period.')).toBeVisible()
      expect(cardValue).toBe(0)
    } else {
      const footer = money(await breakdown.getByTestId('total-sales-by-branch-total').innerText())
      expect(footer).toBeCloseTo(cardValue, 2)
      // Each row is a branch with at least one sale.
      for (const row of await rows.all()) {
        expect(Number(await row.locator('td').nth(1).innerText())).toBeGreaterThan(0)
      }
    }
  })

  test('one branch picked: no breakdown (the card is already that branch)', async ({ page }) => {
    const res = await page.request.get('/api/branches?limit=200')
    const body = await res.json()
    const branches = (Array.isArray(body) ? body : (body.data ?? [])) as {
      id: string
      name: string
    }[]
    expect(branches.length).toBeGreaterThan(0)

    await gotoReady(page, '/pos')
    await pickBranch(page, branches[0])
    await gotoReady(page, '/pos')

    await expect(page.getByTestId('stat-total-sales')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('total-sales-by-branch')).toHaveCount(0)

    // Leave the switcher on All Branches for whatever runs next.
    await pickBranch(page, null)
  })

  // Who gets the panel: everyone who sees every branch (Business Owner, above,
  // and Head Office staff with no branch of their own), never branch staff —
  // their card is already just their branch.
  for (const who of [
    { email: 'technova.cashier@test.com', label: 'Head Office cashier (no branch)', sees: true },
    { email: 'technova.b1.manager@test.com', label: 'Bago branch manager', sees: false },
  ]) {
    test(`${who.label}: panel ${who.sees ? 'shown' : 'not shown'}`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
      const page = await context.newPage()
      await loginAs(page, who.email, ROLE_PASSWORD)
      await gotoReady(page, '/pos')
      await expect(page.getByTestId('stat-total-sales').locator('p.text-2xl')).toBeVisible({
        timeout: 20_000,
      })
      if (who.sees) {
        await expect(page.getByTestId('total-sales-by-branch')).toBeVisible({ timeout: 20_000 })
      } else {
        // Give the session check time to settle before asserting absence.
        await page.waitForLoadState('networkidle').catch(() => {})
        await expect(page.getByTestId('total-sales-by-branch')).toHaveCount(0)
      }
      await context.close()
    })
  }
})
