import { test, expect, type Page } from '@playwright/test'
import { deleteCustomers, gotoReady, sweepE2ECustomers } from './utils'
import {
  fillTheRest,
  getApplication,
  input,
  itemId,
  openNewApplication,
  pickItem,
  pickOption,
  submit,
  term,
} from './credit-application-form'

// Credit application, client list 2026-10-15:
//   - the PPD rebate is not required;
//   - with several items, the rebate is the sum of each item's;
//   - the FMI date (first monthly installment) is called that, and can be
//     changed after the application is raised, as can the PPD rebate.
//
// Price-list figures are the client's own rows, loaded by the seed (WIP, 3 mo):
//   SHARP 2TC32GH3000X   MI 4,845 · PPD 360 · DP 3,380
//   ASTRON LED3277       MI 3,325 · PPD 250 · DP 2,320
//   DOWELL STF3238 fan   on the WIP list with no rate-card row at all

const NAME_PREFIX = 'E2E CA PPD FMI'
const SHARP = '2TC32GH3000X'
const ASTRON = 'LED3277'
const FAN = 'STF3238'

const ppd = (page: Page) => input(page, /^PPD rebate/)
const fmi = (page: Page) => input(page, /^FMI date/)

async function createApplicant(page: Page) {
  const name = `${NAME_PREFIX} Applicant ${Date.now()}${Math.floor(Math.random() * 1000)}`
  const res = await page.request.post('/api/crm/customers', {
    data: {
      name,
      firstName: 'E2E',
      lastName: name.replace('E2E ', ''),
      customerType: 'individual',
      phone: `+63917${Date.now().toString().slice(-7)}`,
    },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return { id: (body.data ?? body).id as string, name }
}

/** The <dd> beside a <dt> on the detail page's Paper Record block. */
const paperRecord = (page: Page, label: string) =>
  page
    .locator('dt', { hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd')
    .first()

test.describe('Credit application — PPD rebate and FMI date', () => {
  const customerIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, NAME_PREFIX)
  })

  test.afterAll(async ({ request }) => {
    await deleteCustomers(request, customerIds)
  })

  test('PF-F01: with several items the PPD rebate is the sum of each item’s', async ({ page }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    await openNewApplication(page, applicant.name)

    await pickItem(page, SHARP)
    await pickOption(term(page), page, '3 months')
    await expect(ppd(page)).toHaveValue('360', { timeout: 15_000 })

    // A second item, also on the card for 3 months: 360 + 250.
    await page.getByRole('button', { name: '+ Add another item' }).click()
    await pickItem(page, ASTRON, 1)
    await expect(ppd(page)).toHaveValue('610', { timeout: 15_000 })

    // The preview now quotes the same contract the application will store —
    // the two items' monthlies added up, not the generic factor-rate figure.
    await expect(page.getByText('Monthly installment').first()).toBeVisible()
    await expect(
      page.locator('div.flex', { hasText: /^Monthly installment/ }).last()
    ).toContainText('₱8,170.00', { timeout: 15_000 })

    // The paper wins: a figure typed over the sum stays put.
    await ppd(page).fill('600')
    await expect(ppd(page)).toHaveValue('600')

    // One item off the card: nothing to sum, so nothing is quoted.
    await ppd(page).fill('')
    await pickItem(page, FAN, 1)
    await expect(ppd(page)).toHaveValue('', { timeout: 15_000 })
  })

  test('PF-F02: an application can be submitted with no PPD rebate', async ({ page }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    await openNewApplication(page, applicant.name)

    // The fan has no rate-card row, so the box stays empty — and used to be
    // the one thing the form refused to submit without.
    await pickItem(page, FAN)
    await pickOption(term(page), page, '3 months')
    await expect(ppd(page)).toHaveValue('')
    await expect(page.getByText(/PPD rebate is required/)).toHaveCount(0)
    await expect(fmi(page)).not.toHaveValue('', { timeout: 15_000 })
    await fillTheRest(page)

    const id = await submit(page)
    const app = await getApplication(page, id)
    expect(app.ppdRebate).toBeNull()
    await expect(paperRecord(page, 'PPD Rebate')).toHaveText('—')
    await expect(paperRecord(page, 'FMI Date')).not.toHaveText('—')
  })

  test('PF-F03: the FMI date and the PPD rebate can be changed after the application is raised', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    const sharpId = await itemId(page, SHARP)
    const created = await page.request.post('/api/credit/applications', {
      data: {
        applicantCustomerId: applicant.id,
        items: [{ itemId: sharpId }],
        firstDueDate: '2026-11-15',
        ppdRebate: 250,
      },
    })
    expect(created.ok()).toBeTruthy()
    const createdBody = await created.json()
    const id = (createdBody.data ?? createdBody).id as string

    await gotoReady(page, `/pos/credit-applications/${id}`)
    await expect(paperRecord(page, 'FMI Date')).toContainText('Nov 15, 2026', { timeout: 15_000 })
    await expect(paperRecord(page, 'PPD Rebate')).toContainText('250.00')

    // Edit: the two boxes are seeded with what is recorded.
    await page.getByRole('button', { name: 'Edit' }).click()
    const editFmi = page.getByLabel('FMI date')
    const editPpd = page.getByLabel(/^PPD rebate/)
    await expect(editFmi).toHaveValue('2026-11-15', { timeout: 15_000 })
    await expect(editPpd).toHaveValue('250')

    await editFmi.fill('2026-12-20')
    await editPpd.fill('310.5')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toHaveCount(0, {
      timeout: 15_000,
    })
    await expect(paperRecord(page, 'FMI Date')).toContainText('Dec 20, 2026', { timeout: 15_000 })
    await expect(paperRecord(page, 'PPD Rebate')).toContainText('310.50')

    // The server stored them, not just the screen.
    const stored = await getApplication(page, id)
    expect(Number(stored.ppdRebate)).toBe(310.5)

    // Blank PPD clears it; FMI is left as it was.
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByLabel(/^PPD rebate/)).toHaveValue('310.5', { timeout: 15_000 })
    await page.getByLabel(/^PPD rebate/).fill('')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toHaveCount(0, {
      timeout: 15_000,
    })
    await expect(paperRecord(page, 'PPD Rebate')).toHaveText('—', { timeout: 15_000 })
    await expect(paperRecord(page, 'FMI Date')).toContainText('Dec 20, 2026')
    expect((await getApplication(page, id)).ppdRebate).toBeNull()
  })
})
