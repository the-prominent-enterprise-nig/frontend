import { test, expect, type APIRequestContext } from '@playwright/test'
import { clickStable, fillAllStable, gotoReady } from './utils'

// Suppliers carry no onboarding gate: a supplier is usable as soon as it is
// saved. No Pending/review chip, no onboarding card (requirement checklist,
// Block, Send for review / Approve), no "Needs attention" filter, and no
// Onboarding status field on the form. Self-cleaning: the created supplier is
// soft-deleted through the supplier API, and a beforeAll sweep clears any
// leftover from a run that never reached its own cleanup.

const PREFIX = 'E2E-NOONB-'

async function sweepSuppliers(request: APIRequestContext): Promise<void> {
  const res = await request.get(`/api/suppliers?search=${PREFIX}&limit=100`)
  if (!res.ok()) return
  const body = await res.json()
  for (const s of (body.data ?? []) as { id: string; code: string }[]) {
    if (s.code.startsWith(PREFIX)) await request.delete(`/api/suppliers/${s.id}`).catch(() => {})
  }
}

test.describe('Suppliers — no onboarding gate', () => {
  test.beforeAll(async ({ request }) => {
    await sweepSuppliers(request)
  })

  test.afterAll(async ({ request }) => {
    await sweepSuppliers(request)
  })

  test('a new supplier is usable straight away', async ({ page }) => {
    await gotoReady(page, '/accounting/suppliers')
    await expect(page.getByRole('button', { name: /Needs attention/ })).toHaveCount(0, {
      timeout: 20_000,
    })

    await clickStable(
      page.getByRole('button', { name: 'New supplier' }),
      page.getByRole('heading', { name: 'New supplier' })
    )
    const code = `${PREFIX}${Date.now()}`
    await fillAllStable([
      { locator: page.locator('#supplier-code'), value: code },
      {
        locator: page.getByPlaceholder('The trading name people recognise'),
        value: `E2E No Onboarding ${code}`,
      },
    ])
    await page.getByRole('button', { name: 'Create supplier' }).click()
    await expect(page.getByRole('heading', { name: 'New supplier' })).toHaveCount(0, {
      timeout: 15_000,
    })

    await page.getByLabel('Search suppliers').fill(code)
    const row = page.getByRole('button', { name: new RegExp(code) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('review', { exact: true })).toHaveCount(0)
    await row.click()

    await expect(page.getByRole('button', { name: 'Edit supplier' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Pending onboarding')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Send for review' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Block' })).toHaveCount(0)

    await clickStable(
      page.getByRole('button', { name: 'Edit supplier' }),
      page.getByRole('heading', { name: 'Edit supplier' })
    )
    await expect(page.getByText('Onboarding status')).toHaveCount(0)
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
