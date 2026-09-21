import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

test.use({ viewport: { width: 1400, height: 1000 } })

test('screenshot customer 360 transaction history', async ({ page }) => {
  test.setTimeout(120_000)
  await gotoReady(page, '/crm/customers/0007660e-8619-46a8-bd7f-ca50d274b370')
  await expect(page.getByRole('heading', { name: 'Transaction History' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('heading', { name: 'Installment Plans' })).toHaveCount(0)
  const section = page.getByRole('heading', { name: 'Transaction History' }).locator('..')
  console.log('\n=== SECTION TEXT ===\n' + (await section.innerText()).slice(0, 500))
  await section.screenshot({ path: 'test-results/c360-history.png' })
})
