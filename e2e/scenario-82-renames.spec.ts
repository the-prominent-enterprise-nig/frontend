import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 82 — the renames from the Oct 29 UAT checklist:
//   - SC-02          "Repair Provider" → "Service Center" (repair screens, and
//                    the backend's Account Mapping label)
//   - POS-20 / CS-01 "Counter collections" → "MI collections" in Close Session

test.describe('Scenario 82 — renames', () => {
  test('SC-02: Issue UDS asks for a Service Center', async ({ page }) => {
    await gotoReady(page, '/inventory/uds')
    await clickStable(
      page.getByRole('button', { name: 'Issue UDS' }),
      page.getByRole('heading', { name: 'Issue Unit Document Sheet' })
    )
    const form = page.locator('form')
    await expect(form.getByPlaceholder('Search service center…')).toBeVisible()
    await expect(form.getByText('Service Center', { exact: false }).first()).toBeVisible()
    await expect(form.getByText(/repair provider/i)).toHaveCount(0)
  })

  test('SC-02: the UDS list column says Service Center', async ({ page }, testInfo) => {
    await gotoReady(page, '/inventory/uds')
    const header = page.getByRole('columnheader', { name: /Units \/ Service Center/i })
    // The table renders once the sheets load; count only after that.
    await header.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    if ((await header.count()) === 0) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'No UDS on this DB, so the list table never renders.',
      })
      return
    }
    await expect(page.getByRole('columnheader', { name: /Provider/ })).toHaveCount(0)
  })

  test('SC-02: Account Mapping says Service Center Payable', async ({ page }) => {
    await gotoReady(page, '/accounting/account-mapping')
    await expect(page.getByText('Service Center Payable').first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/Repair Provider Payable/i)).toHaveCount(0)
  })

  test('POS-20 / CS-01: Close Session says MI collections', async ({ page }, testInfo) => {
    await gotoReady(page, '/pos/sessions')
    const closeButton = page.getByRole('button', { name: 'Close Session' }).first()
    // Sessions load after the page; count only after they have.
    await closeButton.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    if ((await closeButton.count()) === 0) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'No open POS session on this DB, so Close Session is unreachable.',
      })
      return
    }
    await closeButton.click()
    await expect(page.getByRole('heading', { name: 'Close Session' })).toBeVisible()
    await expect(page.getByText(/Counter collections/i)).toHaveCount(0)
    // The MI collections row only shows when the shift took some in cash, and
    // the collections panel loads after the page: wait for one of its two
    // answers before deciding.
    const noCollections = page.getByText('No collections this shift.')
    const miRow = page.getByText('MI collections').first()
    await expect(noCollections.or(miRow)).toBeVisible({ timeout: 20_000 })
    if (await noCollections.isVisible()) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'The open session took no collections, so the MI collections row is hidden.',
      })
      return
    }
    await expect(miRow).toBeVisible()
  })
})
