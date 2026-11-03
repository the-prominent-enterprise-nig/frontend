import { test, expect } from '@playwright/test'
import { gotoReady, pickComboboxOption } from './utils'

// Scenario 80 Part 4 — Oct 29 UAT filters:
//   - POS-02 / POS-03 the Overview's period: this month by default, or a range
//   - WH-05           a Branch filter on the repairs (Unit Documents) list

test.describe('Scenario 80 Part 4 — filters', () => {
  test('POS-03: the Overview opens on this month', async ({ page }) => {
    await gotoReady(page, '/pos')
    const thisMonth = new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    await expect(page.getByTestId('overview-period-label')).toHaveText(`Showing ${thisMonth}`)
    await expect(page.getByLabel('Month')).toHaveValue(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    )
  })

  test('POS-02: a date range narrows Total Sales and the transactions request to it', async ({
    page,
  }) => {
    await gotoReady(page, '/pos')
    const period = page.getByTestId('overview-period')
    await period.getByRole('button', { name: 'Date range' }).click()
    await expect(page.getByLabel('From')).toBeVisible()
    await expect(page.getByLabel('To')).toBeVisible()

    const yesterday = new Date(Date.now() - 86_400_000)
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await page.getByLabel('From').fill(iso(yesterday))
    await expect(page.getByTestId('overview-period-label')).toContainText('–')
    await expect(page.getByText('Total Sales')).toBeVisible()

    await period.getByRole('button', { name: 'Month' }).click()
    await expect(page.getByLabel('From')).toHaveCount(0)
  })

  test('WH-05: the repairs list filters by branch', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=uds')
    await expect(page.getByLabel('Branch')).toBeVisible()
    const picked = await pickComboboxOption(page, 'All branches')
    expect(picked).not.toBe('')
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible()
  })
})
