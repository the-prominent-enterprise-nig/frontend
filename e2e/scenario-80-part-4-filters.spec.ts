import { test, expect } from '@playwright/test'
import { clickStable, gotoReady, pickComboboxOption } from './utils'

// Scenario 80 Part 4 — Oct 29 UAT filters:
//   - POS-02 / POS-03 the Overview's period: this month by default, or a range
//   - WH-05           a Branch filter on the repairs (Unit Documents) list

test.describe('Scenario 80 Part 4 — filters', () => {
  test('POS-03: the Overview opens on this month', async ({ page }) => {
    await gotoReady(page, '/pos')
    const thisMonth = new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    await expect(page.getByTestId('overview-period-label')).toHaveText(`Showing ${thisMonth}`)
    // Scenario 84 Part 5 — the month is a stepper now, not a typed month box.
    await expect(page.getByTestId('overview-month')).toHaveText(thisMonth)
  })

  test('POS-02: a date range narrows Total Sales and the transactions request to it', async ({
    page,
  }) => {
    await gotoReady(page, '/pos')
    const period = page.getByTestId('overview-period')
    // clickStable: the first click can land before the page hydrates.
    await clickStable(
      period.getByRole('button', { name: 'Date range' }),
      page.getByLabel('From', { exact: true })
    )
    await expect(page.getByLabel('To', { exact: true })).toBeVisible()

    const yesterday = new Date(Date.now() - 86_400_000)
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await page.getByLabel('From', { exact: true }).fill(iso(yesterday))
    await expect(page.getByTestId('overview-period-label')).toContainText('–')
    await expect(page.getByText('Total Sales')).toBeVisible()

    await period.getByRole('button', { name: 'Month', exact: true }).click()
    await expect(page.getByLabel('From', { exact: true })).toHaveCount(0)
  })

  test('WH-05: the repairs list filters by branch', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=uds')
    await expect(page.getByLabel('Branch')).toBeVisible()
    const picked = await pickComboboxOption(page, 'All branches')
    expect(picked).not.toBe('')
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible()
  })
})
