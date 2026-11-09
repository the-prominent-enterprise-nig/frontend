import { test, expect, type Page } from '@playwright/test'
import { deleteCustomers, fillAllStable, gotoReady, sweepE2ECustomers } from './utils'

// Ticket #31 — "assign area per collector": a collector covers towns, and a
// new installment account is assigned the collector covering the customer's
// town, with its Area filled in from it.

const CUSTOMER_NAME_PREFIX = 'E2E TownFixture'

/** Retries fill + submit + verify together — a hydration reconciliation can
 * wipe already-filled fields between an earlier fill and the submit click
 * (see crm-collectors-installment-accounts.spec.ts's submitStable). */
async function submitStable(
  fill: () => Promise<void>,
  submit: () => Promise<void>,
  verify: () => Promise<void>
): Promise<void> {
  await expect(async () => {
    await fill()
    await submit()
    await verify()
  }).toPass({ timeout: 30_000 })
}

/** Drives one of CollectorTownPicker's type-ahead dropdowns. */
async function pickTownLevel(page: Page, placeholder: string, optionLabel: string) {
  const combobox = page.getByPlaceholder(placeholder, { exact: true })
  await expect(async () => {
    await combobox.click()
    await combobox.fill(optionLabel)
    const option = page.getByRole('button', { name: optionLabel, exact: true })
    await expect(option).toBeVisible({ timeout: 2_000 })
    await option.click()
    await expect(combobox).toHaveValue(optionLabel, { timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
}

/** Region VI is pre-selected, so a town is just Province → City → Add. */
async function addTown(page: Page, town: { province: string; city: string }) {
  await expect(page.getByPlaceholder('Select region', { exact: true })).toHaveValue(
    'Region VI (Western Visayas)'
  )
  await pickTownLevel(page, 'Select province', town.province)
  await pickTownLevel(page, 'Select city / municipality', town.city)
  await page.getByRole('button', { name: 'Add town', exact: true }).click()
}

test.describe('CRM — Collector towns (Ticket #31)', () => {
  let createdCustomerIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, CUSTOMER_NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await deleteCustomers(request, createdCustomerIds)
    createdCustomerIds = []
  })

  test('assigns, edits and removes the towns a collector covers', async ({ page }) => {
    const suffix = Date.now()
    const stubNumber = `E2E-${String(suffix).slice(-8)}`
    const name = `E2E Town Collector ${suffix}`
    const sanJose = { province: 'Antique', city: 'San Jose (Capital)' }
    const sibalom = { province: 'Antique', city: 'Sibalom' }

    await gotoReady(page, '/crm/collectors/new')
    await submitStable(
      async () => {
        await fillAllStable([
          { locator: page.getByLabel('Collector code *'), value: stubNumber },
          { locator: page.getByLabel('Name *'), value: name },
        ])
        if (!(await page.getByText('Towns covered (1)').isVisible())) {
          await addTown(page, sanJose)
        }
        await expect(page.getByText('Towns covered (1)')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Remove San Jose (Capital)' })).toBeVisible()
      },
      () => page.getByRole('button', { name: 'Create collector' }).click(),
      () => expect(page).toHaveURL(/\/crm\/collectors\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const collectorId = page.url().match(/\/crm\/collectors\/([a-f0-9-]+)$/)?.[1]
    expect(collectorId).toBeTruthy()

    // The detail page lists the town under its own heading, apart from barangays.
    await expect(page.getByRole('heading', { name: 'Towns covered' })).toBeVisible()
    await expect(page.getByText('San Jose (Capital)')).toBeVisible({ timeout: 10_000 })

    // Edit — add Sibalom, then take San Jose off.
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(`/crm/collectors/${collectorId}/edit`)
    await expect(page.getByRole('button', { name: 'Remove San Jose (Capital)' })).toBeVisible({
      timeout: 10_000,
    })
    await submitStable(
      async () => {
        // Idempotent on retry, like the barangay-coverage spec.
        if (!(await page.getByRole('button', { name: 'Remove Sibalom' }).isVisible())) {
          await addTown(page, sibalom)
        }
        if (await page.getByRole('button', { name: 'Remove San Jose (Capital)' }).isVisible()) {
          await page.getByRole('button', { name: 'Remove San Jose (Capital)' }).click()
        }
        await expect(page.getByText('Towns covered (1)')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Remove San Jose (Capital)' })).toHaveCount(0)
      },
      () => page.getByRole('button', { name: 'Save changes' }).click(),
      () => expect(page).toHaveURL(`/crm/collectors/${collectorId}`, { timeout: 8_000 })
    )
    await expect(page.getByText('Sibalom')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('San Jose (Capital)')).toHaveCount(0)

    // The stored rows themselves, not just the labels.
    const detail = await page.request.get(`/api/crm/collectors/${collectorId}`)
    expect((await detail.json()).towns).toEqual([{ cityCode: '060616', cityName: 'Sibalom' }])

    const del = await page.request.delete(`/api/crm/collectors/${collectorId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('an installment account for a customer in a covered town is assigned that collector, with its Area', async ({
    page,
  }) => {
    const suffix = Date.now()
    const shortSuffix = String(suffix).slice(-8)
    // Ivana, Batanes — a town no other fixture covers; Salagao is one of its barangays.
    const town = { cityCode: '020903', cityName: 'Ivana' }
    const barangayCode = '020903002'

    const collectorName = `E2E Town-Match Collector ${suffix}`
    const stubNumber = `E2ETWN${shortSuffix}`
    const collectorRes = await page.request.post('/api/crm/collectors', {
      data: { stubNumber, name: collectorName, areaTowns: [town] },
    })
    expect(collectorRes.ok()).toBeTruthy()
    const collectorId = (await collectorRes.json()).id as string

    // The customer lives in a barangay no collector covers — only the town.
    const customerName = `${CUSTOMER_NAME_PREFIX}${suffix}`
    const customerRes = await page.request.post('/api/crm/customers', {
      data: {
        name: customerName,
        phone: `0917${String(suffix).slice(-7)}`,
        barangayCode,
      },
    })
    expect(customerRes.ok()).toBeTruthy()
    createdCustomerIds.push((await customerRes.json()).id as string)

    await gotoReady(page, '/crm/installment-accounts/new')
    const accountNumber = `E2E-IA-TWN-${suffix}`
    await submitStable(
      async () => {
        if (!(await page.getByRole('button', { name: 'Change customer' }).isVisible())) {
          const picker = page.getByPlaceholder('Search customer by name, email, or phone…')
          const result = page.getByRole('button', { name: new RegExp(customerName) })
          await expect(async () => {
            await picker.click()
            await picker.fill(customerName.slice(-10))
            await expect(result).toBeVisible({ timeout: 3_000 })
          }).toPass({ timeout: 20_000 })
          await result.click()
        }
        // The form pre-selects the collector the customer's town points to.
        const collectorSelect = page.getByLabel('Collector')
        await expect(collectorSelect).toHaveValue(collectorId, { timeout: 10_000 })
        await expect(
          collectorSelect.locator('option', {
            hasText: `${stubNumber} — ${collectorName} — suggested`,
          })
        ).toHaveCount(1)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '6' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '20000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '2000' },
          { locator: page.getByLabel('MI factor *'), value: '0.1' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]

    const account = await (
      await page.request.get(`/api/crm/installment-accounts/${accountId}`)
    ).json()
    expect(account.collectorId).toBe(collectorId)
    expect(account.area).toBe('IVANA')

    // Cleanup
    expect(
      (await page.request.delete(`/api/crm/installment-accounts/${accountId}`)).ok()
    ).toBeTruthy()
    expect((await page.request.delete(`/api/crm/collectors/${collectorId}`)).ok()).toBeTruthy()
  })
})
