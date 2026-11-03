import { test, expect, type Page } from '@playwright/test'
import { deleteCustomers, gotoReady, sweepE2ECustomers } from './utils'
import {
  fieldBox,
  fillTheRest,
  input,
  itemId,
  openNewApplication,
  pickItem,
  pickOption,
  submit,
  term,
} from './credit-application-form'

// Credit application, client list 2026-10-15: "when a customer changes their
// address on a credit application, it shouldn't affect their record. It should
// only record on the credit application."
//
// 020901002 is Ihubok I, Basco, Batanes — the barangay the collector specs also
// use as an unlikely-to-collide fixture. The address below is the picker's own
// composed shape, so it recovers "12 Old Street" as the street line.

const NAME_PREFIX = 'E2E CA ADDR'
const FAN = 'STF3238'
const BARANGAY_CODE = '020901002'
const OLD_ADDRESS =
  '12 Old Street, Ihubok I, Basco, Batanes, Region II (Cagayan Valley), Philippines'

async function createApplicant(page: Page, withAddress = true) {
  const name = `${NAME_PREFIX} Applicant ${Date.now()}${Math.floor(Math.random() * 1000)}`
  const res = await page.request.post('/api/crm/customers', {
    data: {
      name,
      firstName: 'E2E',
      lastName: name.replace('E2E ', ''),
      customerType: 'individual',
      phone: `+63917${Date.now().toString().slice(-7)}`,
      ...(withAddress ? { address: OLD_ADDRESS, barangayCode: BARANGAY_CODE } : {}),
    },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return { id: (body.data ?? body).id as string, name }
}

async function getCustomer(page: Page, id: string) {
  const res = await page.request.get(`/api/crm/customers/${id}`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return (body.data ?? body) as { address: string | null; barangayCode: string | null }
}

const currentAddress = (page: Page) =>
  page
    .locator('dt', { hasText: /^Current address$/ })
    .locator('xpath=following-sibling::dd')
    .first()

test.describe('Credit application — the applicant’s address stays on the application', () => {
  const customerIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, NAME_PREFIX)
  })

  test.afterAll(async ({ request }) => {
    await deleteCustomers(request, customerIds)
  })

  test('AD-F01: an address changed on the form is recorded on the application, not on the customer', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    await openNewApplication(page, applicant.name)

    // The profile opens by itself (a new customer has gaps); the street line
    // fills from the customer's saved address once the barangay data loads.
    const street = input(page, /^House \/ Unit \/ Street \/ Building/)
    await expect(street).toHaveValue(/12 Old Street/, { timeout: 20_000 })
    await street.fill('99 New Street')

    await pickItem(page, FAN)
    await pickOption(term(page), page, '3 months')
    await fillTheRest(page)
    const id = await submit(page)

    // On the application: the address as changed, same barangay.
    const res = await page.request.get(`/api/credit/applications/${id}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const application = (body.data ?? body) as {
      applicantAddress: string | null
      applicantBarangayCode: string | null
    }
    expect(application.applicantAddress).toContain('99 New Street')
    expect(application.applicantAddress).toContain('Ihubok I')
    expect(application.applicantBarangayCode).toBe(BARANGAY_CODE)

    // On the customer: untouched.
    const customer = await getCustomer(page, applicant.id)
    expect(customer.address).toBe(OLD_ADDRESS)
    expect(customer.barangayCode).toBe(BARANGAY_CODE)

    // And the detail page shows the application's address.
    await expect(currentAddress(page)).toContainText('99 New Street', { timeout: 15_000 })
    await expect(currentAddress(page)).not.toContainText('12 Old Street')
  })

  test('AD-F02: other profile changes still reach the customer; only the address stays', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    await openNewApplication(page, applicant.name)

    const street = input(page, /^House \/ Unit \/ Street \/ Building/)
    await expect(street).toHaveValue(/12 Old Street/, { timeout: 20_000 })
    await street.fill('5 Another Street')
    await fieldBox(page, /^Last name/)
      .locator('input')
      .first()
      .fill('Renamed')

    await pickItem(page, FAN)
    await pickOption(term(page), page, '3 months')
    await fillTheRest(page)
    await submit(page)

    const res = await page.request.get(`/api/crm/customers/${applicant.id}`)
    const json = await res.json()
    const customer = (json.data ?? json) as { address: string | null; lastName: string | null }
    expect(customer.lastName).toBe('Renamed')
    expect(customer.address).toBe(OLD_ADDRESS)
  })

  test('AD-F03: an application with no address of its own shows the customer’s', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    customerIds.push(applicant.id)
    const fanId = await itemId(page, FAN)
    const created = await page.request.post('/api/credit/applications', {
      data: { applicantCustomerId: applicant.id, items: [{ itemId: fanId }] },
    })
    expect(created.ok()).toBeTruthy()
    const createdBody = await created.json()
    const id = (createdBody.data ?? createdBody).id as string

    await gotoReady(page, `/pos/credit-applications/${id}`)
    await expect(currentAddress(page)).toContainText('12 Old Street', { timeout: 15_000 })
  })
})
