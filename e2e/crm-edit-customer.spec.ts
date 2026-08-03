import { test, expect } from '@playwright/test'
import { gotoReady, fillAllStable } from './utils'

// CRM — Edit Customer. Covers the merged CustomerForm's edit-mode branches
// (customer code, source channel, PATCH submit, dirty-tracking) that don't
// exist in the create flow, plus a regression guard for the Payment
// Terms/Status/Bank Details fields that were dropped from both forms.
test.describe('CRM — Edit Customer', () => {
  test('loads existing values, stays disabled until changed, and saves an update', async ({
    page,
  }) => {
    const uniqueSuffix = Date.now()
    const originalLastName = `EditMe${uniqueSuffix}`
    const updatedLastName = `Edited${uniqueSuffix}`

    const seedRes = await page.request.post('/api/crm/customers', {
      data: {
        name: `E2E ${originalLastName}`,
        sourceChannel: 'sales',
        email: `edit-${uniqueSuffix}@example.com`,
        phone: `+639${uniqueSuffix.toString().slice(-9)}`,
      },
    })
    const seeded = await seedRes.json()

    await gotoReady(page, `/crm/customers/${seeded.id}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeVisible()

    // Loaded values, including the auto-generated code create doesn't show.
    await expect(page.getByLabel('Customer code *')).toHaveValue(seeded.customerCode)
    await expect(page.getByLabel('Last name *')).toHaveValue(originalLastName)

    // Regression guard: these three were removed from both forms.
    await expect(page.getByText('Payment terms')).not.toBeVisible()
    await expect(page.getByText('Status', { exact: true })).not.toBeVisible()
    await expect(page.getByText('Bank details')).not.toBeVisible()
    // But edit keeps its own extra fields create doesn't have.
    await expect(page.getByText('Source channel')).toBeVisible()

    // Dirty-tracking: nothing changed yet, so Save stays disabled.
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await fillAllStable([{ locator: page.getByLabel('Last name *'), value: updatedLastName }])
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled()

    await expect(async () => {
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page).toHaveURL(`/crm/customers/${seeded.id}`, { timeout: 8_000 })
    }).toPass({ timeout: 20_000 })

    await expect(page.getByRole('heading', { name: `E2E ${updatedLastName}` })).toBeVisible()

    await page.request.delete(`/api/crm/customers/${seeded.id}`)
  })
})
