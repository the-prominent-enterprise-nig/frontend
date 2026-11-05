import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 85 Part 3 — Oct 29 UAT POS-01. With "All Branches" picked, the POS
// Overview's Total Sales card is every branch combined; a "Total Sales by
// branch" breakdown now sits under it, and its total equals the card. With
// one branch picked the card is already that branch, so no breakdown.
//
// Works on whatever sales the DB has this month: either branches with sales
// whose total matches the card, or "No sales in this period." with a ₱0 card.
// The exact per-branch figures and branch scoping are covered by the backend
// e2e scenario-85-sales-by-branch.

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
})
