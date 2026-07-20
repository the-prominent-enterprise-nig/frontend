import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// My Workspace > Configuration was removed entirely. Its three tabs are now
// reachable only from POS Settings, using the existing branch switcher
// (already on every POS Settings page) as the mode selector instead of a
// separate tab: "All Branches" edits the tenant-wide default, a specific
// branch edits that branch's override. Payment Methods briefly gained a
// separate business-wide enable/disable section from that migration, but
// the backend payment-method-config merge later made the per-method table's
// own toggle the single, checkout-enforced control — so that section was
// removed again rather than kept as a second control.

test.describe('POS Settings — Configuration migration', () => {
  test('/settings/configuration is gone and the Sidebar no longer links to it', async ({
    page,
  }) => {
    const response = await page.goto('/settings/configuration', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(404)

    await gotoReady(page, '/dashboard')
    await expect(page.getByRole('link', { name: 'Configuration' })).toHaveCount(0)
  })

  test('Receipt Branding: "All Branches" edits the company default, a specific branch edits its own override', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/settings/receipt-branding')

    const branchSelect = page.locator('select').first()

    // Fresh session default is "All Branches" (branchId: null) — confirm
    // explicitly rather than assume, then check the tenant-default editor.
    // ReceiptBrandingCardShell renders its "label" prop as plain styled text,
    // not a heading element, so match on text rather than role=heading.
    await branchSelect.selectOption('')
    await expect(page.getByText('Company Default', { exact: true })).toBeVisible()
    await expect(
      page.getByText('This is the company-wide default logo, header, and footer')
    ).toBeVisible()

    // Selecting a specific branch switches to that branch's override editor.
    // Match the full sentence, not just "Manila HQ" alone — that string also
    // matches the (hidden, closed) <option> in the branch switcher itself.
    await branchSelect.selectOption({ label: 'Manila HQ' })
    await expect(page.getByText('Branch Override', { exact: true })).toBeVisible()
    await expect(page.getByText('Overriding the company default for Manila HQ.')).toBeVisible()
  })

  test('Payment Methods: the per-method table toggle is the single, checkout-enforced control', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/settings/payment-methods')

    // The separate "Business-wide payment methods" section (a stopgap from
    // the Configuration migration) was removed once the backend payment-
    // method-config merge landed — the per-method table's own toggle is now
    // the single real, checkout-enforced control.
    await expect(page.getByRole('region', { name: 'Business-wide payment methods' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Visible at Checkout' })).toBeVisible()

    // The table's own toggle still works end to end.
    const firstToggle = page.getByRole('switch').first()
    const before = await firstToggle.getAttribute('aria-checked')
    await firstToggle.click()
    await expect(firstToggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')

    // Flip it back so this test is idempotent across reruns.
    await firstToggle.click()
    await expect(firstToggle).toHaveAttribute('aria-checked', before ?? 'true')
  })
})
