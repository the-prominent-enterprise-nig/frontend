import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'
import {
  fillTheRest,
  getApplication,
  input,
  itemId,
  itemRow,
  pickItem,
  pickOption,
  seedDraft,
  submit,
  term,
} from './credit-application-form'

// Nov UAT — a credit application takes a ₱0 down payment if and ONLY if at
// least one of its items was price-overridden at the till. The flag is never
// typed on the form: it rides along from the cart (the draft checkout writes
// when "New credit application" is clicked), and it is kept through an edit.
//
// The backend rules (what is refused, the card's fixed figure letting go, the
// flag following an item through an edit) are covered by
// backend/test/credit-application-financing.e2e-spec.ts; this spec drives the
// form that sends them.
//
// DOWELL STF3238 is on the WIP list with no rate-card row, so its down payment
// is open — nothing fixes it. Applications are never deleted, so nothing is
// cleaned up (the same tradeoff as the other credit specs).

const NAME_PREFIX = 'E2E ZeroDown'
const FAN = 'STF3238'
const SHARP = '2TC32GH3000X'

const zeroAllowedHint = (page: Page) => page.getByTestId('down-payment-zero-allowed')
const overriddenNote = (page: Page) => page.getByTestId('credit-application-item-overridden')
const downPayment = (page: Page) => input(page, /^Down Payment/)

async function createApplicant(page: Page): Promise<{ id: string; name: string }> {
  const name = `${NAME_PREFIX} ${Date.now()}${Math.floor(Math.random() * 1000)}`
  const res = await page.request.post('/api/pos/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `+63917${Date.now().toString().slice(-7)}`,
      coMakers: [
        { name: 'E2E ZD Co-Maker', relationship: 'Sibling', contactNumber: '+639171118888' },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const parsed = await res.json()
  const customer = parsed.data ?? parsed
  return { id: customer.id, name }
}

/** The fan has no PPD on the price list, so the box is empty and the form asks
 * for the paper's figure — 0 when it shows none. */
const fillNoPpd = (page: Page): Promise<void> => input(page, /^PPD rebate/).fill('0')

test.describe('Credit application — ₱0 down only with a price override', () => {
  test.describe.configure({ timeout: 150_000 })

  test('ZD-F01: raised from a cart with an overridden item, ₱0 down is accepted and saved', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    const fanId = await itemId(page, FAN)

    // What checkout writes when the cart's item carries a price override.
    await seedDraft(page, {
      applicantCustomerId: applicant.id,
      items: [{ itemId: fanId, itemLabel: FAN, priceOverridden: true }],
    })
    await gotoReady(page, `/pos/credit-applications/new?applicantCustomerId=${applicant.id}`)

    await expect(overriddenNote(page)).toBeVisible({ timeout: 15_000 })
    await pickOption(term(page), page, '3 months')
    await expect(zeroAllowedHint(page)).toBeVisible({ timeout: 15_000 })
    await expect(downPayment(page)).toHaveAttribute('placeholder', 'Any amount, including 0')

    await downPayment(page).fill('0')
    // Past the form's debounced check — nothing is wrong with 0 here.
    await page.waitForTimeout(1_000)
    await expect(page.getByText(/Down payment must be more than 0/)).toHaveCount(0)

    await fillTheRest(page)
    await fillNoPpd(page)
    const id = await submit(page)

    const app = await getApplication(page, id)
    expect(Number(app.downPayment)).toBe(0)
    expect(Number(app.amountFinanced)).toBeGreaterThan(0)
    expect(app.items).toHaveLength(1)
    expect((app.items[0] as { priceOverridden?: boolean }).priceOverridden).toBe(true)

    // The detail page says which item carried the override.
    await expect(page.getByTestId('credit-application-detail-overridden')).toBeVisible({
      timeout: 15_000,
    })
  })

  test('ZD-F02: without an override, 0 is refused under the field and the form does not submit', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    const fanId = await itemId(page, FAN)

    // The same cart, but nothing on it was overridden.
    await seedDraft(page, {
      applicantCustomerId: applicant.id,
      items: [{ itemId: fanId, itemLabel: FAN }],
    })
    await gotoReady(page, `/pos/credit-applications/new?applicantCustomerId=${applicant.id}`)

    await expect(overriddenNote(page)).toHaveCount(0)
    await pickOption(term(page), page, '3 months')
    await expect(downPayment(page)).toHaveAttribute('placeholder', 'Any amount above 0', {
      timeout: 15_000,
    })
    await expect(zeroAllowedHint(page)).toHaveCount(0)

    await downPayment(page).fill('0')
    await expect(page.getByText(/Down payment must be more than 0/).first()).toBeVisible({
      timeout: 10_000,
    })

    await fillTheRest(page)
    await fillNoPpd(page)
    await page.getByRole('button', { name: 'Submit Application' }).click()
    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/pos\/credit-applications\/new/)
  })

  test('ZD-F03: changing the overridden item takes the override — and ₱0 — away', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    const fanId = await itemId(page, FAN)

    await seedDraft(page, {
      applicantCustomerId: applicant.id,
      items: [{ itemId: fanId, itemLabel: FAN, priceOverridden: true }],
    })
    await gotoReady(page, `/pos/credit-applications/new?applicantCustomerId=${applicant.id}`)
    await expect(overriddenNote(page)).toBeVisible({ timeout: 15_000 })

    // A different item was not priced by that override.
    await pickItem(page, SHARP, 0)
    await expect(overriddenNote(page)).toHaveCount(0)
    await expect(itemRow(page, 0)).toBeVisible()
  })

  test('ZD-F04: an overridden application can be edited to 0, and keeps its override', async ({
    page,
  }) => {
    const applicant = await createApplicant(page)
    const wip = await page.request.get('/api/pos/catalog/price-use-types')
    type PriceUse = { id: string; name: string }
    const body = (await wip.json()) as PriceUse[] | { data?: PriceUse[] }
    const wipId = (Array.isArray(body) ? body : (body.data ?? [])).find((t) => t.name === 'WIP')!.id

    const created = await page.request.post('/api/credit/applications', {
      data: {
        applicantCustomerId: applicant.id,
        items: [{ itemId: await itemId(page, FAN), priceOverridden: true }],
        priceUseTypeId: wipId,
      },
    })
    expect(created.ok(), await created.text()).toBeTruthy()
    const createdBody = await created.json()
    const id = (createdBody.data ?? createdBody).id as string

    await gotoReady(page, `/pos/credit-applications/${id}`)
    await expect(page.getByTestId('credit-application-detail-overridden')).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Estimated amount')).toBeVisible({ timeout: 15_000 })

    await pickOption(term(page), page, '3 months')
    await expect(zeroAllowedHint(page)).toBeVisible({ timeout: 15_000 })
    await downPayment(page).fill('0')
    await page.waitForTimeout(1_000)

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toHaveCount(0, {
      timeout: 20_000,
    })

    const app = await getApplication(page, id)
    expect(Number(app.downPayment)).toBe(0)
    expect((app.items[0] as { priceOverridden?: boolean }).priceOverridden).toBe(true)
  })

  test('ZD-F05: an application with no override cannot be edited to 0', async ({ page }) => {
    const applicant = await createApplicant(page)
    const wip = await page.request.get('/api/pos/catalog/price-use-types')
    type PriceUse = { id: string; name: string }
    const body = (await wip.json()) as PriceUse[] | { data?: PriceUse[] }
    const wipId = (Array.isArray(body) ? body : (body.data ?? [])).find((t) => t.name === 'WIP')!.id

    const created = await page.request.post('/api/credit/applications', {
      data: {
        applicantCustomerId: applicant.id,
        items: [{ itemId: await itemId(page, FAN) }],
        priceUseTypeId: wipId,
      },
    })
    expect(created.ok(), await created.text()).toBeTruthy()
    const createdBody = await created.json()
    const id = (createdBody.data ?? createdBody).id as string

    await gotoReady(page, `/pos/credit-applications/${id}`)
    await expect(page.getByTestId('credit-application-detail-overridden')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Estimated amount')).toBeVisible({ timeout: 15_000 })

    await pickOption(term(page), page, '3 months')
    await expect(zeroAllowedHint(page)).toHaveCount(0)
    await downPayment(page).fill('0')
    await expect(page.getByText(/Down payment must be more than 0/).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})
