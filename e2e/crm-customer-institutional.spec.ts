import { test, expect, type Page } from '@playwright/test'
import { deleteCustomers, gotoReady, pickFromCustomSelect, sweepE2ECustomers } from './utils'

// Client item "Institutional — allow customer (business) to be tagged as
// institutional". A label only: an "Institutional" checkbox on the customer
// form (Business only), shown on Customer 360 and in the customer list, which
// can also filter on it.
// Deliberately without the word "Institutional", so a tag check can't match
// the customer's own name.
const NAME_PREFIX = 'E2E InstTag'

test.describe('CRM — Institutional customer tag', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await deleteCustomers(request, createdIds)
    createdIds = []
  })

  async function seedCustomer(page: Page, label: string, body: Record<string, unknown>) {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const res = await page.request.post('/api/crm/customers', {
      data: {
        name: `${NAME_PREFIX} ${label} ${suffix}`,
        sourceChannel: 'sales',
        phone: `+639${suffix.slice(-9)}`,
        ...body,
      },
    })
    expect(res.ok()).toBeTruthy()
    const seeded = (await res.json()) as {
      id: string
      name: string
      isInstitutional: boolean
    }
    createdIds.push(seeded.id)
    return seeded
  }

  async function saveEdit(page: Page, id: string) {
    // Retry the click only until the save lands (a click before hydration
    // does nothing), then wait for the redirect on its own: on a cold dev
    // server the Customer 360 route can take a while to compile, and
    // re-clicking Save meanwhile would only submit again.
    await expect(async () => {
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.getByText('Customer updated')).toBeVisible({ timeout: 8_000 })
    }).toPass({ timeout: 20_000 })
    await expect(page).toHaveURL(`/crm/customers/${id}`, { timeout: 45_000 })
  }

  async function storedTag(page: Page, id: string) {
    const res = await page.request.get(`/api/crm/customers/${id}`)
    return ((await res.json()) as { isInstitutional: boolean }).isInstitutional
  }

  test('tagging a business customer on edit shows on Customer 360 and in the list, and the list filters on it', async ({
    page,
  }) => {
    const tagged = await seedCustomer(page, 'Hospital', {
      customerType: 'business',
      businessCategory: 'government',
      companyName: 'Provincial Hospital',
    })
    const untagged = await seedCustomer(page, 'Trading', {
      customerType: 'business',
      businessCategory: 'private',
    })

    await gotoReady(page, `/crm/customers/${tagged.id}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeVisible()
    const checkbox = page.getByRole('checkbox', { name: 'Institutional' })
    await expect(checkbox).toBeVisible()
    await expect(checkbox).not.toBeChecked()

    await checkbox.check()
    await saveEdit(page, tagged.id)

    // Customer 360 header: beside the business category, not instead of it.
    const header = page.locator('header').filter({ hasText: tagged.name })
    await expect(header).toContainText('Government · ')
    await expect(header).toContainText('Institutional · ')
    expect(await storedTag(page, tagged.id)).toBe(true)

    // The list: a badge on the tagged row only.
    await gotoReady(page, '/crm/customers')
    await page.getByPlaceholder('Search code, name, email, phone, company…').fill(NAME_PREFIX)
    const taggedRow = page.locator('tbody tr').filter({ hasText: tagged.name })
    const untaggedRow = page.locator('tbody tr').filter({ hasText: untagged.name })
    await expect(taggedRow).toBeVisible({ timeout: 10_000 })
    await expect(untaggedRow).toBeVisible()
    await expect(taggedRow.getByText('Institutional', { exact: true })).toBeVisible()
    await expect(untaggedRow.getByText('Institutional', { exact: true })).toHaveCount(0)

    // Filter: Institutional only.
    const onlyTagged = page.waitForRequest(
      (r) => r.url().includes('/crm/customers') && r.url().includes('isInstitutional=true'),
      { timeout: 10_000 }
    )
    await page.getByLabel('Filter by Institutional').selectOption('true')
    await onlyTagged
    await expect(taggedRow).toBeVisible({ timeout: 10_000 })
    await expect(untaggedRow).toHaveCount(0)

    // Filter: not institutional only.
    const onlyUntagged = page.waitForRequest(
      (r) => r.url().includes('/crm/customers') && r.url().includes('isInstitutional=false'),
      { timeout: 10_000 }
    )
    await page.getByLabel('Filter by Institutional').selectOption('false')
    await onlyUntagged
    await expect(untaggedRow).toBeVisible({ timeout: 10_000 })
    await expect(taggedRow).toHaveCount(0)
  })

  test('the checkbox is offered for a business only, and appears when the type changes to Business', async ({
    page,
  }) => {
    const individual = await seedCustomer(page, 'Person', { customerType: 'individual' })

    await gotoReady(page, `/crm/customers/${individual.id}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Institutional' })).toHaveCount(0)

    await pickFromCustomSelect(page, 'Individual', 'Business')
    const checkbox = page.getByRole('checkbox', { name: 'Institutional' })
    await expect(checkbox).toBeVisible()
    await checkbox.check()
    await saveEdit(page, individual.id)

    await expect(page.locator('header').filter({ hasText: individual.name })).toContainText(
      'Institutional · '
    )
    expect(await storedTag(page, individual.id)).toBe(true)
  })

  test('changing a tagged customer to Individual removes the tag', async ({ page }) => {
    const tagged = await seedCustomer(page, 'School', {
      customerType: 'business',
      isInstitutional: true,
    })
    expect(tagged.isInstitutional).toBe(true)

    await gotoReady(page, `/crm/customers/${tagged.id}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeVisible()
    // Loads ticked.
    await expect(page.getByRole('checkbox', { name: 'Institutional' })).toBeChecked()

    await pickFromCustomSelect(page, 'Business', 'Individual')
    await expect(page.getByRole('checkbox', { name: 'Institutional' })).toHaveCount(0)
    await saveEdit(page, tagged.id)

    await expect(page.locator('header').filter({ hasText: tagged.name })).not.toContainText(
      'Institutional'
    )
    expect(await storedTag(page, tagged.id)).toBe(false)
  })
})
