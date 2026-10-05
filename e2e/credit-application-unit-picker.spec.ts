import {
  test,
  expect,
  request as apiRequest,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test'
import { gotoReady, loginAs } from './utils'
import {
  fieldBox,
  fillTheRest,
  getApplication,
  input,
  itemId,
  itemRow,
  openNewApplication,
  pickItem,
  pickOption,
  seedDraft,
  submit,
  term,
} from './credit-application-form'

// Scenario 64 item 29 — the unit for a serial item can be picked on the
// credit application itself, not only at the till.
//
// Before: the form had no serial picker. A unit picked at the till rode along
// when the application was raised from a cart, but an item added or changed
// on the form never had one, so the cashier always picked it at the sale.
// Now a serial item's row offers this branch's in-stock units — optional,
// never a hold — and "Continue to sale" brings the picked unit into the cart.
// The Edit Financing Request form offers it too, and its save no longer drops
// the unit already recorded (backend update() keeps it; #185).
//
// Runs as the Bago cashier against the dev servers' data: it needs the
// SHARP 2TC32GH3000X and the DOWELL STF3238 fan in stock at Bago, and the
// cashier's Counter 1 session open for the "Continue to sale" test (the same
// setup as pr199-checkout-down-payment). Applications are never deleted, so
// nothing is cleaned up — the same tradeoff as the other credit specs.

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
const OWNER_STATE = 'e2e/.auth/business-owner.json'
const NAME_PREFIX = 'E2E Unit Picker'
const SHARP = '2TC32GH3000X'
const FAN = 'STF3238'
const UNIT_PLACEHOLDER = "Search this branch's units in stock…"

type Unit = { id: string; serialNumber: string }

const unitField = (scope: Page | Locator): Locator => fieldBox(scope, /^Unit \(serial\)/)
/** The closed picker — a button showing the picked unit or the placeholder. */
const unitTrigger = (scope: Page | Locator): Locator => unitField(scope).getByRole('button').first()
/** The picker's × — the second button in the field, shown once a unit is set. */
const unitClear = (scope: Page | Locator): Locator => unitField(scope).getByRole('button').nth(1)

/** The fan has no PPD on the price list, so the box is left empty and the
 * form asks for the paper's figure — 0 when it shows none. */
const fillNoPpd = (page: Page): Promise<void> => input(page, /^PPD rebate/).fill('0')

async function pickUnit(page: Page, scope: Page | Locator, serial: string): Promise<void> {
  await unitTrigger(scope).click()
  await page.getByRole('button', { name: serial, exact: true }).click()
  await expect(unitTrigger(scope)).toHaveText(serial)
}

async function bagoBranchId(page: Page): Promise<string> {
  const res = await page.request.get('/api/branches?limit=200')
  expect(res.ok()).toBeTruthy()
  const branches = ((await res.json()).data ?? []) as { id: string; name: string }[]
  const bago = branches.find((b) => b.name === 'Bago')
  expect(bago, 'no Bago branch').toBeTruthy()
  return bago!.id
}

/** The units the till itself would offer at Bago — the picker's own query. */
async function bagoUnits(page: Page, forItemId: string, status = 'in_stock'): Promise<Unit[]> {
  const branchId = await bagoBranchId(page)
  const res = await page.request.get(
    `/api/inventory/serial-numbers?itemId=${forItemId}&status=${status}&forSale=true&branchId=${branchId}&limit=100`
  )
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return (Array.isArray(body) ? body : (body.data ?? [])) as Unit[]
}

async function createApplicant(
  page: Page
): Promise<{ id: string; name: string; coMakerId: string }> {
  // Two applicants made in the same millisecond must still differ.
  const name = `${NAME_PREFIX} ${Date.now()}${Math.floor(Math.random() * 1000)}`
  // POS, not CRM: a cashier does not hold crm:customers:create.
  const res = await page.request.post('/api/pos/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `+63917${Date.now().toString().slice(-7)}`,
      coMakers: [
        { name: 'E2E Unit Co-Maker', relationship: 'Sibling', contactNumber: '+639171117777' },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  const customer = body.data ?? body
  return { id: customer.id, name, coMakerId: customer.coMakers[0].id }
}

/** An active, non-serial, non-service item, found by its SKU (shown under
 * its name in the item search when it has no model number). */
async function nonSerialItemSku(page: Page): Promise<string> {
  const res = await page.request.get('/api/inventory/items?limit=100&lifecycle=active')
  expect(res.ok()).toBeTruthy()
  const items = ((await res.json()).data ?? []) as {
    sku: string
    modelNumber: string | null
    isSerialTracked: boolean
    isService?: boolean
  }[]
  const plain = items.find((i) => !i.isSerialTracked && !i.isService && !i.modelNumber)
  expect(plain, 'no active non-serial item to pick').toBeTruthy()
  return plain!.sku
}

async function wipPriceUseId(page: Page): Promise<string> {
  const res = await page.request.get('/api/pos/catalog/price-use-types')
  type PriceUse = { id: string; name: string }
  const body = (await res.json()) as PriceUse[] | { data?: PriceUse[] }
  const types = Array.isArray(body) ? body : (body.data ?? [])
  return types.find((t) => t.name === 'WIP')!.id
}

/** Takes an application through investigation and approves every item, as
 * the owner — a cashier cannot decide one. */
async function approveAsOwner(owner: APIRequestContext, id: string): Promise<void> {
  const app = await (await owner.get(`/api/credit/applications/${id}`)).json()
  const itemIds = ((app.data ?? app).items as { id: string }[]).map((i) => i.id)
  const steps: [string, () => Promise<{ ok(): boolean; text(): Promise<string> }>][] = [
    ['submit', () => owner.patch(`/api/credit/applications/${id}/submit`)],
    ['start', () => owner.post(`/api/credit/applications/${id}/investigation/start`)],
    [
      'investigate',
      () =>
        owner.post(`/api/credit/applications/${id}/investigation`, {
          data: { affordabilityOutcome: 'recommend_approve', notes: 'E2E unit picker' },
        }),
    ],
    [
      'decide',
      () =>
        owner.patch(`/api/credit/applications/${id}/decide`, {
          data: { approveItemIds: itemIds, declineItemIds: [] },
        }),
    ],
  ]
  for (const [step, run] of steps) {
    const res = await run()
    expect(res.ok(), `${step}: ${await res.text()}`).toBeTruthy()
  }
}

test.describe('Scenario 64 item 29 — the unit on a credit application (cashier)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.describe.configure({ timeout: 150_000 })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)
  })

  test("a serial item offers this branch's units in stock; a non-serial item offers none", async ({
    page,
  }) => {
    const sharpUnits = await bagoUnits(page, await itemId(page, SHARP))
    expect(sharpUnits.length, 'no SHARP in stock at Bago').toBeGreaterThan(0)
    const soldSharp = await bagoUnits(page, await itemId(page, SHARP), 'sold')
    const plainSku = await nonSerialItemSku(page)

    await gotoReady(page, '/pos/credit-applications/new')

    // Not a serial item: nothing extra on the row.
    await pickItem(page, plainSku)
    await expect(itemRow(page).getByText('Estimated amount')).toBeVisible({ timeout: 15_000 })
    await expect(unitField(page)).toHaveCount(0)

    // A serial item: the optional picker, empty, with its hint.
    await pickItem(page, SHARP)
    await expect(unitField(page)).toBeVisible({ timeout: 15_000 })
    await expect(unitField(page)).toContainText('optional')
    await expect(unitTrigger(page)).toHaveText(UNIT_PLACEHOLDER)
    await expect(
      page.getByText('Pick the unit now, or leave it blank and pick it at the till.')
    ).toBeVisible()

    // Exactly the units the till would offer here — in stock, at Bago.
    await unitTrigger(page).click()
    for (const unit of sharpUnits.slice(0, 10)) {
      await expect(page.getByRole('button', { name: unit.serialNumber, exact: true })).toBeVisible({
        timeout: 15_000,
      })
    }
    for (const unit of soldSharp.slice(0, 5)) {
      await expect(page.getByRole('button', { name: unit.serialNumber, exact: true })).toHaveCount(
        0
      )
    }

    // Typing narrows the list to matching serials.
    const target = sharpUnits[0].serialNumber
    await unitField(page).locator('input').fill(target)
    await expect(page.getByRole('button', { name: target, exact: true })).toBeVisible({
      timeout: 10_000,
    })
    for (const other of sharpUnits.filter((u) => !u.serialNumber.includes(target)).slice(0, 3)) {
      await expect(page.getByRole('button', { name: other.serialNumber, exact: true })).toHaveCount(
        0
      )
    }
  })

  test('the unit picked on the form is saved on the application', async ({ page }) => {
    const sharpId = await itemId(page, SHARP)
    const [unit] = await bagoUnits(page, sharpId)
    expect(unit, 'no SHARP in stock at Bago').toBeTruthy()
    const applicant = await createApplicant(page)

    await openNewApplication(page, applicant.name)
    await pickItem(page, SHARP)
    await pickOption(term(page), page, '3 months')
    await pickUnit(page, page, unit.serialNumber)
    await fillTheRest(page)

    const app = await getApplication(page, await submit(page))
    expect(app.items).toHaveLength(1)
    expect(app.items[0].itemId).toBe(sharpId)
    expect(app.items[0].serialNumberId).toBe(unit.id)
    expect(app.items[0].serialNumber?.serialNumber).toBe(unit.serialNumber)
  })

  test("changing the item clears the unit and offers the new item's units", async ({ page }) => {
    const [sharpUnit] = await bagoUnits(page, await itemId(page, SHARP))
    const fanId = await itemId(page, FAN)
    const fanUnits = await bagoUnits(page, fanId)
    expect(fanUnits.length, 'no STF3238 fan in stock at Bago').toBeGreaterThan(0)
    const applicant = await createApplicant(page)

    await openNewApplication(page, applicant.name)
    await pickItem(page, SHARP)
    await pickUnit(page, page, sharpUnit.serialNumber)

    await pickItem(page, FAN)
    await expect(unitTrigger(page)).toHaveText(UNIT_PLACEHOLDER, { timeout: 15_000 })
    await unitTrigger(page).click()
    await expect(
      page.getByRole('button', { name: fanUnits[0].serialNumber, exact: true })
    ).toBeVisible({ timeout: 15_000 })
    // The SHARP's units are not the fan's.
    await expect(
      page.getByRole('button', { name: sharpUnit.serialNumber, exact: true })
    ).toHaveCount(0)
    await page.getByRole('button', { name: fanUnits[0].serialNumber, exact: true }).click()
    await expect(unitTrigger(page)).toHaveText(fanUnits[0].serialNumber)

    await pickOption(term(page), page, '3 months')
    await fillTheRest(page)
    await fillNoPpd(page)
    const app = await getApplication(page, await submit(page))
    expect(app.items[0].itemId).toBe(fanId)
    expect(app.items[0].serialNumberId).toBe(fanUnits[0].id)
  })

  test('a unit cleared again leaves the application without one', async ({ page }) => {
    const [unit] = await bagoUnits(page, await itemId(page, SHARP))
    const applicant = await createApplicant(page)

    await openNewApplication(page, applicant.name)
    await pickItem(page, SHARP)
    await pickOption(term(page), page, '3 months')
    await pickUnit(page, page, unit.serialNumber)
    await unitClear(page).click()
    // The × reopens the search, empty, ready for another unit.
    await expect(unitField(page).locator('input')).toHaveAttribute('placeholder', UNIT_PLACEHOLDER)
    await expect(unitField(page).locator('input')).toHaveValue('')
    // Walked away from, it stays blank.
    await page.getByText('Items / Models').click()
    await expect(unitTrigger(page)).toHaveText(UNIT_PLACEHOLDER)
    await fillTheRest(page)

    const app = await getApplication(page, await submit(page))
    expect(app.items[0].serialNumberId).toBeNull()
  })

  test.describe('raised from the till', () => {
    test("the till's unit is already filled in, and a serial line without one offers the picker", async ({
      page,
    }) => {
      const sharpId = await itemId(page, SHARP)
      const fanId = await itemId(page, FAN)
      const [sharpUnit] = await bagoUnits(page, sharpId)
      const applicant = await createApplicant(page)

      // What checkout writes for a cart of a SHARP with its unit picked and a
      // fan whose unit was not picked yet.
      await seedDraft(page, {
        applicantCustomerId: applicant.id,
        items: [
          {
            itemId: sharpId,
            itemLabel: SHARP,
            serialNumberId: sharpUnit.id,
            serialNumberLabel: sharpUnit.serialNumber,
            isSerialTracked: true,
          },
          { itemId: fanId, itemLabel: FAN, isSerialTracked: true },
        ],
      })
      await gotoReady(page, `/pos/credit-applications/new?applicantCustomerId=${applicant.id}`)

      const sharpRow = itemRow(page, 0)
      const fanRow = itemRow(page, 1)
      await expect(unitTrigger(sharpRow)).toHaveText(sharpUnit.serialNumber, { timeout: 15_000 })
      await expect(unitTrigger(fanRow)).toHaveText(UNIT_PLACEHOLDER)

      await pickOption(term(page), page, '3 months')
      await fillTheRest(page)
      await fillNoPpd(page)
      const app = await getApplication(page, await submit(page))
      const byItem = new Map(app.items.map((i) => [i.itemId, i.serialNumberId]))
      expect(byItem.get(sharpId)).toBe(sharpUnit.id)
      expect(byItem.get(fanId)).toBeNull()
    })

    test('a draft from before the label was carried still shows that a unit is set', async ({
      page,
    }) => {
      const sharpId = await itemId(page, SHARP)
      const [sharpUnit] = await bagoUnits(page, sharpId)
      const applicant = await createApplicant(page)

      await seedDraft(page, {
        applicantCustomerId: applicant.id,
        items: [{ itemId: sharpId, itemLabel: SHARP, serialNumberId: sharpUnit.id }],
      })
      await gotoReady(page, `/pos/credit-applications/new?applicantCustomerId=${applicant.id}`)
      await expect(unitTrigger(page)).toHaveText('Unit picked at the till', { timeout: 15_000 })
    })
  })

  test.describe('the Edit Financing Request form', () => {
    /** An application for the SHARP with `unit` recorded, open in the edit form. */
    async function openEditWithUnit(page: Page, unit: Unit | null): Promise<string> {
      const applicant = await createApplicant(page)
      const res = await page.request.post('/api/credit/applications', {
        data: {
          applicantCustomerId: applicant.id,
          coMakerId: applicant.coMakerId,
          items: [
            { itemId: await itemId(page, SHARP), ...(unit ? { serialNumberId: unit.id } : {}) },
          ],
          priceUseTypeId: await wipPriceUseId(page),
        },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      const created = await res.json()
      const id = (created.data ?? created).id as string

      await gotoReady(page, `/pos/credit-applications/${id}`)
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByText('Estimated amount')).toBeVisible({ timeout: 15_000 })
      return id
    }

    async function save(page: Page): Promise<void> {
      await page.getByRole('button', { name: 'Save Changes' }).click()
      await expect(page.getByRole('heading', { name: 'Edit Financing Request' })).toHaveCount(0, {
        timeout: 20_000,
      })
    }

    test('shows the unit on record, and saving without touching it keeps it', async ({ page }) => {
      // Before: the form had no unit, and its save replaced the items without
      // one — so the unit picked at the till was lost on any edit.
      const [unit] = await bagoUnits(page, await itemId(page, SHARP))
      const id = await openEditWithUnit(page, unit)

      await expect(unitTrigger(page)).toHaveText(unit.serialNumber, { timeout: 15_000 })
      await save(page)
      const app = await getApplication(page, id)
      expect(app.items[0].serialNumberId).toBe(unit.id)
    })

    test("changing the item clears the unit, and the new item's unit is saved", async ({
      page,
    }) => {
      const [sharpUnit] = await bagoUnits(page, await itemId(page, SHARP))
      const fanId = await itemId(page, FAN)
      const [fanUnit] = await bagoUnits(page, fanId)
      const id = await openEditWithUnit(page, sharpUnit)

      await pickItem(page, FAN)
      await expect(unitTrigger(page)).toHaveText(UNIT_PLACEHOLDER, { timeout: 15_000 })
      await pickUnit(page, page, fanUnit.serialNumber)
      await save(page)

      const app = await getApplication(page, id)
      expect(app.items).toHaveLength(1)
      expect(app.items[0].itemId).toBe(fanId)
      expect(app.items[0].serialNumberId).toBe(fanUnit.id)
    })

    test('a unit picked for an item that had none is saved; clearing it again removes it', async ({
      page,
    }) => {
      const [unit] = await bagoUnits(page, await itemId(page, SHARP))
      const id = await openEditWithUnit(page, null)

      await expect(unitTrigger(page)).toHaveText(UNIT_PLACEHOLDER, { timeout: 15_000 })
      await pickUnit(page, page, unit.serialNumber)
      await save(page)
      expect((await getApplication(page, id)).items[0].serialNumberId).toBe(unit.id)

      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await expect(unitTrigger(page)).toHaveText(unit.serialNumber, { timeout: 15_000 })
      await unitClear(page).click()
      // Click away — the page behind has its own "Items / Models" heading.
      await page.getByRole('heading', { name: 'Edit Financing Request' }).click()
      await expect(unitTrigger(page)).toHaveText(UNIT_PLACEHOLDER)
      await save(page)
      expect((await getApplication(page, id)).items[0].serialNumberId).toBeNull()
    })
  })

  test('"Continue to sale" brings the unit on the application into the cart', async ({
    page,
    baseURL,
  }) => {
    const sharpId = await itemId(page, SHARP)
    const [unit] = await bagoUnits(page, sharpId)
    const applicant = await createApplicant(page)
    const res = await page.request.post('/api/credit/applications', {
      data: {
        applicantCustomerId: applicant.id,
        coMakerId: applicant.coMakerId,
        items: [{ itemId: sharpId, serialNumberId: unit.id }],
        priceUseTypeId: await wipPriceUseId(page),
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const created = await res.json()
    const id = (created.data ?? created).id as string

    const owner = await apiRequest.newContext({ baseURL, storageState: OWNER_STATE })
    try {
      await approveAsOwner(owner, id)
    } finally {
      await owner.dispose()
    }

    await gotoReady(page, `/pos/credit-applications/${id}`)
    const sell = page.getByRole('button', { name: 'Continue to sale' })
    await expect(sell, "the cashier's Counter 1 session must be open").toBeEnabled({
      timeout: 20_000,
    })
    await sell.click()
    await expect(page).toHaveURL(/\/pos\/checkout/, { timeout: 20_000 })

    // Picked, not asked for: the line carries the unit, in green.
    await expect(page.getByRole('button', { name: `SN: ${unit.serialNumber}` })).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByRole('button', { name: '⚠ Select serial' })).toHaveCount(0)
  })
})

test.describe('Scenario 64 item 29 — a user with no branch', () => {
  test('is not offered a unit — there is no telling which branch will sell it', async ({
    page,
  }) => {
    // The owner (the default login) has no branch of their own.
    await gotoReady(page, '/pos/credit-applications/new')
    await pickItem(page, SHARP)
    await expect(itemRow(page).getByText('Estimated amount')).toBeVisible({ timeout: 15_000 })
    await expect(unitField(page)).toHaveCount(0)
  })

  test("is offered one when editing — the application's own branch is known", async ({ page }) => {
    const branchId = await bagoBranchId(page)
    const customer = await page.request.post('/api/crm/customers', {
      data: {
        name: `${NAME_PREFIX} Owner ${Date.now()}`,
        customerType: 'individual',
        phone: `+63917${Date.now().toString().slice(-7)}`,
        coMakers: [
          { name: 'E2E Unit Co-Maker', relationship: 'Sibling', contactNumber: '+639171117778' },
        ],
      },
    })
    expect(customer.ok(), await customer.text()).toBeTruthy()
    const body = await customer.json()
    const res = await page.request.post('/api/credit/applications', {
      data: {
        branchId,
        applicantCustomerId: (body.data ?? body).id,
        coMakerId: (body.data ?? body).coMakers[0].id,
        items: [{ itemId: await itemId(page, SHARP) }],
        priceUseTypeId: await wipPriceUseId(page),
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const created = await res.json()

    await gotoReady(page, `/pos/credit-applications/${(created.data ?? created).id}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(unitField(page)).toBeVisible({ timeout: 15_000 })
    // Bago's units — the application's branch, not the owner's (none).
    const [unit] = await bagoUnits(page, await itemId(page, SHARP))
    await unitTrigger(page).click()
    await expect(page.getByRole('button', { name: unit.serialNumber, exact: true })).toBeVisible({
      timeout: 15_000,
    })
  })
})
