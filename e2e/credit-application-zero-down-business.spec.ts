import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'
import {
  fieldBox,
  fillTheRest,
  getApplication,
  input,
  itemId,
  pickOption,
  seedDraft,
  submit,
  term,
} from './credit-application-form'

// Docket #48 — a Cashier takes a ₱0 down payment for a BUSINESS customer
// without overriding any price. Checkout already allowed it (Nov UAT, PR #278),
// but a private business still needs an approved credit application, and the
// application form refused ₱0 unless an item carried a price override — so the
// override was needed after all. "Institutional" is a business customer (the
// government sub-category), not a type of its own.
//
// Anyone who is not a business still needs the override (ZD-F02 in
// credit-application-zero-down-override.spec.ts, and BZ-F05 below).
//
// The backend rules (the card's fixed figure letting go for a business, the
// cap at the item total, switching the applicant) are covered by
// backend/test/credit-application-financing.e2e-spec.ts and the checkout end
// to end by backend/test/pos-zero-down-payment-and-rebate.e2e-spec.ts; this
// spec drives the form.
//
// DOWELL STF3238 is on the WIP list with no rate-card row, so its down payment
// is open — nothing fixes it. Applications are never deleted, so nothing is
// cleaned up (the same tradeoff as the other credit specs).

const NAME_PREFIX = 'E2E BizZeroDown'
const FAN = 'STF3238'

type CustomerType = 'individual' | 'self_employed' | 'business' | 'employee'

const zeroAllowedHint = (page: Page) => page.getByTestId('down-payment-zero-allowed')
const overriddenNote = (page: Page) => page.getByTestId('credit-application-item-overridden')
const downPayment = (page: Page) => input(page, /^Down Payment/)
const employment = (page: Page) => fieldBox(page, /^Employment/).getByRole('combobox')
const refusedZero = (page: Page) => page.getByText(/Down payment must be more than 0/)

async function createApplicant(
  page: Page,
  customerType: CustomerType,
  businessCategory?: 'private' | 'government'
): Promise<{ id: string; name: string }> {
  const name = `${NAME_PREFIX} ${Date.now()}${Math.floor(Math.random() * 1000)}`
  const res = await page.request.post('/api/pos/customers', {
    data: {
      name,
      customerType,
      ...(businessCategory ? { businessCategory } : {}),
      phone: `+63917${Date.now().toString().slice(-7)}`,
      coMakers: [
        { name: 'E2E BZ Co-Maker', relationship: 'Sibling', contactNumber: '+639171117777' },
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

/** Opens the New Credit Application form for the applicant with the fan on it,
 * nothing overridden — what checkout hands over for an ordinary cart. */
async function openForFan(page: Page, applicantId: string): Promise<void> {
  const fanId = await itemId(page, FAN)
  await seedDraft(page, {
    applicantCustomerId: applicantId,
    items: [{ itemId: fanId, itemLabel: FAN }],
  })
  await gotoReady(page, `/pos/credit-applications/new?applicantCustomerId=${applicantId}`)
  await expect(overriddenNote(page)).toHaveCount(0)
  await pickOption(term(page), page, '3 months')
}

async function wipPriceUseId(page: Page): Promise<string> {
  const res = await page.request.get('/api/pos/catalog/price-use-types')
  type PriceUse = { id: string; name: string }
  const body = (await res.json()) as PriceUse[] | { data?: PriceUse[] }
  return (Array.isArray(body) ? body : (body.data ?? [])).find((t) => t.name === 'WIP')!.id
}

test.describe('Credit application — ₱0 down for a business customer (Docket #48)', () => {
  test.describe.configure({ timeout: 150_000 })

  test('BZ-F01: a private business applicant takes ₱0 down with no price override, and it is saved', async ({
    page,
  }) => {
    const applicant = await createApplicant(page, 'business', 'private')
    await openForFan(page, applicant.id)

    await expect(zeroAllowedHint(page)).toBeVisible({ timeout: 15_000 })
    await expect(zeroAllowedHint(page)).toHaveText(/business customer/)
    await expect(downPayment(page)).toHaveAttribute('placeholder', 'Any amount, including 0')

    await downPayment(page).fill('0')
    // Past the form's debounced check — nothing is wrong with 0 here.
    await page.waitForTimeout(1_000)
    await expect(refusedZero(page)).toHaveCount(0)

    await fillTheRest(page)
    await fillNoPpd(page)
    const id = await submit(page)

    const app = await getApplication(page, id)
    expect(Number(app.downPayment)).toBe(0)
    expect(Number(app.amountFinanced)).toBeGreaterThan(0)
    expect(app.items).toHaveLength(1)
    // No override anywhere — that is the point of the ticket.
    expect((app.items[0] as { priceOverridden?: boolean }).priceOverridden).toBe(false)
  })

  test('BZ-F02: a government (institutional) business applicant takes ₱0 down too', async ({
    page,
  }) => {
    const applicant = await createApplicant(page, 'business', 'government')
    await openForFan(page, applicant.id)

    await expect(zeroAllowedHint(page)).toBeVisible({ timeout: 15_000 })
    await downPayment(page).fill('0')
    await page.waitForTimeout(1_000)
    await expect(refusedZero(page)).toHaveCount(0)
  })

  test('BZ-F03 (edge): retyping the applicant’s Employment to Business and back moves the ₱0 rule with it', async ({
    page,
  }) => {
    const applicant = await createApplicant(page, 'individual')
    await openForFan(page, applicant.id)

    await downPayment(page).fill('0')
    await expect(refusedZero(page).first()).toBeVisible({ timeout: 10_000 })

    // Business — the refusal clears without touching the down payment again.
    await pickOption(employment(page), page, 'Business')
    await expect(zeroAllowedHint(page)).toBeVisible({ timeout: 10_000 })
    await expect(refusedZero(page)).toHaveCount(0, { timeout: 10_000 })

    // Back to Individual — refused again.
    await pickOption(employment(page), page, 'Individual')
    await expect(zeroAllowedHint(page)).toHaveCount(0)
    await expect(refusedZero(page).first()).toBeVisible({ timeout: 10_000 })

    // Business once more, and the application saves at ₱0 — the type change
    // reaches the customer's record first, so the server agrees.
    await pickOption(employment(page), page, 'Business')
    await expect(refusedZero(page)).toHaveCount(0, { timeout: 10_000 })
    await fillTheRest(page)
    await fillNoPpd(page)
    const id = await submit(page)
    const app = await getApplication(page, id)
    expect(Number(app.downPayment)).toBe(0)
  })

  test('BZ-F04: a business applicant’s application can be edited down to ₱0', async ({ page }) => {
    const applicant = await createApplicant(page, 'business', 'private')
    const created = await page.request.post('/api/credit/applications', {
      data: {
        applicantCustomerId: applicant.id,
        items: [{ itemId: await itemId(page, FAN) }],
        priceUseTypeId: await wipPriceUseId(page),
      },
    })
    expect(created.ok(), await created.text()).toBeTruthy()
    const createdBody = await created.json()
    const id = (createdBody.data ?? createdBody).id as string

    await gotoReady(page, `/pos/credit-applications/${id}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Estimated amount')).toBeVisible({ timeout: 15_000 })

    await pickOption(term(page), page, '3 months')
    await expect(zeroAllowedHint(page)).toBeVisible({ timeout: 15_000 })
    await expect(zeroAllowedHint(page)).toHaveText(/business customer/)
    await downPayment(page).fill('0')
    await page.waitForTimeout(1_000)
    await expect(refusedZero(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toHaveCount(0, {
      timeout: 20_000,
    })

    const app = await getApplication(page, id)
    expect(Number(app.downPayment)).toBe(0)
    expect((app.items[0] as { priceOverridden?: boolean }).priceOverridden).toBe(false)
  })

  for (const customerType of ['self_employed', 'employee'] as const) {
    test(`BZ-F05 (regression): a ${customerType} applicant with no override is still refused ₱0`, async ({
      page,
    }) => {
      const applicant = await createApplicant(page, customerType)
      await openForFan(page, applicant.id)

      await expect(downPayment(page)).toHaveAttribute('placeholder', 'Any amount above 0', {
        timeout: 15_000,
      })
      await expect(zeroAllowedHint(page)).toHaveCount(0)
      await downPayment(page).fill('0')
      await expect(refusedZero(page).first()).toBeVisible({ timeout: 10_000 })

      await fillTheRest(page)
      await fillNoPpd(page)
      await page.getByRole('button', { name: 'Submit Application' }).click()
      await page.waitForTimeout(2_000)
      await expect(page).toHaveURL(/\/pos\/credit-applications\/new/)
    })
  }
})
