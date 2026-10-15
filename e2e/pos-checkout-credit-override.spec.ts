import {
  test,
  expect,
  type APIRequestContext,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test'
import {
  gotoReady,
  fillStable,
  sweepE2ECustomers,
  sweepE2EPriceLists,
  sweepE2EPriceUseTypes,
  deleteCustomers,
  openCustomSelect,
  pickCartPriceUse,
} from './utils'

// Scenario 71 Part 5 — overriding the credit application. A cashier can sell on
// an application that does not cover the cart, or that is not approved yet: no
// manager, a reason and a note, flagged for the end-of-day review. The backend
// rules (what is refused, what is recorded, the application left untouched) are
// covered by backend/test/pos-credit-application-override.e2e-spec.ts; this
// spec covers the checkout that drives them — the option, the picker, the
// difference it shows — and one real sale read back through the review page.
//
// The seed leaves nothing sellable that also has a price, so this spec builds
// its own two items, Price Use and price list, as the other checkout specs do.

const PREFIX = 'E2E CreditOverride'
const BRANCH = 'Bago'
const ITEM_PRICE = 12000

type Fixtures = {
  items: { id: string; name: string }[]
  priceUseTypeName: string
  priceUseTypeId: string
  priceListId: string
  branchId: string
}

let fx: Fixtures
const createdCustomerIds: string[] = []

async function ownerRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
}

async function createFixtures(request: APIRequestContext): Promise<Fixtures> {
  const stamp = Date.now()

  const anyItemRes = await request.get('/api/inventory/items?limit=1')
  const baseUnitId = ((await anyItemRes.json()).data ?? [])[0].baseUnit.id as string

  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
  const warehouses = ((await (await request.get('/api/inventory/warehouses?limit=200')).json())
    .data ?? []) as { id: string; branchId: string | null }[]
  const warehouse = warehouses.find((w) => w.branchId === branchId)!

  const items: { id: string; name: string }[] = []
  for (const letter of ['A', 'B']) {
    const name = `${PREFIX} Item ${letter} ${stamp}`
    const itemRes = await request.post('/api/inventory/items', {
      data: {
        sku: `E2E-CO71-${letter}-${stamp}`,
        name,
        baseUnitId,
        isSerialTracked: false,
        sellingPrice: ITEM_PRICE,
      },
    })
    expect(itemRes.ok(), await itemRes.text()).toBeTruthy()
    const item = await itemRes.json()
    await request.post(`/api/inventory/items/${item.id}/submit`)
    await request.post(`/api/inventory/items/${item.id}/confirm-accounting`, { data: {} })
    await request.post(`/api/inventory/items/${item.id}/approve`, { data: {} })

    const adjustRes = await request.post('/api/inventory/adjustments', {
      data: {
        warehouseId: warehouse.id,
        adjustmentDate: new Date().toISOString().slice(0, 10),
        reasonCode: 'found',
        notes: 'E2E credit override fixture stock',
        lines: [{ itemId: item.id, expectedQty: 0, actualQty: 50 }],
      },
    })
    expect(adjustRes.ok(), await adjustRes.text()).toBeTruthy()
    const adjustment = await adjustRes.json()
    for (const step of ['confirm', 'investigate', 'approve']) {
      const stepRes = await request.patch(`/api/inventory/adjustments/${adjustment.id}/${step}`)
      expect(stepRes.ok(), await stepRes.text()).toBeTruthy()
    }
    items.push({ id: item.id, name })
  }

  const priceUseTypeName = `${PREFIX} PU ${stamp}`
  const putRes = await request.post('/api/inventory/price-use-types', {
    data: { name: priceUseTypeName },
  })
  expect(putRes.ok(), await putRes.text()).toBeTruthy()
  const priceUseType = await putRes.json()

  const listRes = await request.post('/api/inventory/price-lists', {
    data: { name: `${PREFIX} List ${stamp}`, priceUseTypeId: priceUseType.id },
  })
  expect(listRes.ok(), await listRes.text()).toBeTruthy()
  const priceList = await listRes.json()
  const itemsRes = await request.post(`/api/inventory/price-lists/${priceList.id}/items`, {
    data: { items: items.map((i) => ({ itemId: i.id, price: ITEM_PRICE })) },
  })
  expect(itemsRes.ok(), await itemsRes.text()).toBeTruthy()
  const approveRes = await request.post(`/api/inventory/price-lists/${priceList.id}/approve`, {
    data: {},
  })
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy()

  return {
    items,
    priceUseTypeName,
    priceUseTypeId: priceUseType.id,
    priceListId: priceList.id,
    branchId,
  }
}

async function ensureOpenSession(request: APIRequestContext, branchId: string): Promise<void> {
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  if (open.length) return
  await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
}

async function openCheckout(page: Page): Promise<void> {
  await gotoReady(page, '/pos/checkout')
  await expect(page.getByPlaceholder('Search by name or serial')).toBeVisible({ timeout: 15_000 })
  const sessionSelect = page.locator('select').filter({ hasText: 'Select session' })
  const autoSelected = page.getByText(/^Counter \d+$/).first()
  await expect(sessionSelect.or(autoSelected)).toBeVisible({ timeout: 15_000 })
  if (await sessionSelect.isVisible()) {
    const value = await sessionSelect
      .locator('option', { hasText: BRANCH })
      .first()
      .getAttribute('value')
    await sessionSelect.selectOption(value!)
  }
}

/** Puts the fixture item on the cart as line `index` and prices it under the fixture Price Use. */
async function addItem(page: Page, item: { name: string }, index: number): Promise<void> {
  const search = page.getByPlaceholder('Search by name or serial')
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill(item.name)
  const card = page.getByRole('button').filter({ has: page.getByText(item.name, { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await card.first().click()
  await pickCartPriceUse(page, fx.priceUseTypeName, index)
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

const exceptionSection = (page: Page) => page.getByTestId('price-override-exception')
const overrideBox = (page: Page) => page.getByTestId('credit-override-checkbox')
const waiverBox = (page: Page) => page.getByTestId('credit-waiver-checkbox')

/** The customer, with one application for the given items. `decide` takes it all
 * the way to approved; without it the application is left as a draft. */
async function createCustomerWithApplication(
  request: APIRequestContext,
  label: string,
  itemIndexes: number[],
  decide: boolean
): Promise<{ customer: { id: string; name: string }; applicationNumber: string }> {
  const stamp = Date.now()
  const name = `${PREFIX} ${label} ${stamp}`
  const customerRes = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${stamp.toString().slice(-7)}`,
      coMakers: [
        { name: `${PREFIX} Co-Maker`, relationship: 'Sibling', contactNumber: '09171112222' },
      ],
    },
  })
  expect(customerRes.ok(), await customerRes.text()).toBeTruthy()
  const customer = await customerRes.json()
  createdCustomerIds.push(customer.id)

  const appRes = await request.post('/api/credit/applications', {
    data: {
      branchId: fx.branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      priceUseTypeId: fx.priceUseTypeId,
      items: itemIndexes.map((i) => ({ itemId: fx.items[i].id })),
    },
  })
  expect(appRes.ok(), await appRes.text()).toBeTruthy()
  const application = await appRes.json()

  if (decide) {
    const uploadRes = await request.post('/api/files/upload', {
      multipart: {
        file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') },
      },
    })
    const file = await uploadRes.json()
    const steps: [string, string, object?][] = [
      [
        'post',
        `/api/credit/applications/${application.id}/documents`,
        { fileId: file.id, documentType: 'applicant_id' },
      ],
      ['patch', `/api/credit/applications/${application.id}/submit`],
      ['post', `/api/credit/applications/${application.id}/investigation/start`],
      [
        'post',
        `/api/credit/applications/${application.id}/investigation`,
        { affordabilityOutcome: 'recommend_approve', notes: 'E2E' },
      ],
      [
        'patch',
        `/api/credit/applications/${application.id}/decide`,
        {
          approveItemIds: (application.items as { id: string }[]).map((i) => i.id),
          declineItemIds: [],
        },
      ],
    ]
    for (const [method, url, data] of steps) {
      const res = await (method === 'post'
        ? request.post(url, { data })
        : request.patch(url, { data }))
      expect(res.ok(), `${method} ${url}: ${await res.text()}`).toBeTruthy()
    }
  }
  return {
    customer: { id: customer.id, name },
    applicationNumber: application.applicationNumber as string,
  }
}

/** Items on the cart, the customer picked, everything switched to in-house installment. */
async function startInstallmentCart(
  page: Page,
  customerName: string,
  itemIndexes: number[]
): Promise<void> {
  await openCheckout(page)
  for (const [line, itemIndex] of itemIndexes.entries()) {
    await addItem(page, fx.items[itemIndex], line)
  }
  await selectCustomer(page, customerName)
  await page.getByRole('button', { name: 'Installment', exact: true }).click()
  await expect(page.getByTestId('credit-override-panel')).toBeVisible({ timeout: 15_000 })
}

// The override checkbox is hidden (SHOW_CREDIT_OVERRIDE in checkout/page.tsx, 2026-10-15) —
// waive + typed terms covers the same sale. Re-enable with that flag, then drop the .skip.
test.describe.skip('POS Checkout — overriding the credit application (Scenario 71 Part 5)', () => {
  test.describe.configure({ timeout: 120_000 })

  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await sweepE2ECustomers(request, PREFIX)
    await sweepE2EPriceLists(request, PREFIX)
    await sweepE2EPriceUseTypes(request, PREFIX)
    fx = await createFixtures(request)
    await ensureOpenSession(request, fx.branchId)
    await request.dispose()
  })

  test.afterAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await deleteCustomers(request, createdCustomerIds)
    if (fx) {
      await request.delete(`/api/inventory/price-lists/${fx.priceListId}`).catch(() => {})
      await request.delete(`/api/inventory/price-use-types/${fx.priceUseTypeId}`).catch(() => {})
      for (const item of fx.items) {
        await request.delete(`/api/inventory/items/${item.id}`).catch(() => {})
      }
    }
    await request.dispose()
  })

  test('CO-F01: the option is offered once there is a customer and an installment line — not on a cash cart — and it excludes the waiver', async ({
    page,
  }) => {
    const { customer } = await createCustomerWithApplication(page.request, 'F01', [0], true)
    await openCheckout(page)
    await addItem(page, fx.items[0], 0)
    await selectCustomer(page, customer.name)
    // A cash cart has nothing to attach an application to.
    await expect(page.getByTestId('credit-override-panel')).toHaveCount(0)

    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(page.getByTestId('credit-override-panel')).toBeVisible({ timeout: 15_000 })
    await expect(overrideBox(page)).not.toBeChecked()

    // Overriding and waiving are two ways of doing without one: ticking either clears the other.
    await expect(async () => {
      await overrideBox(page).check()
      await expect(overrideBox(page)).toBeChecked({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
    await expect(page.getByTestId('credit-override-body')).toBeVisible()
    await waiverBox(page).check()
    await expect(overrideBox(page)).not.toBeChecked()
    await expect(page.getByTestId('credit-override-body')).toHaveCount(0)
    await overrideBox(page).check()
    await expect(waiverBox(page)).not.toBeChecked()
  })

  test('CO-F02: an approved application that does not cover the cart shows what it does not cover, and the sale needs a reason and a note', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await createCustomerWithApplication(
      page.request,
      'F02',
      [0],
      true
    )
    await startInstallmentCart(page, customer.name, [0, 1])

    await expect(async () => {
      await overrideBox(page).check()
      await expect(page.getByTestId('credit-override-body')).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
    await expect(page.getByTestId('credit-override-body')).toContainText('flagged for review')

    const picker = page.getByRole('combobox', { name: 'Select the application to override…' })
    await openCustomSelect(picker)
    await page
      .getByRole('listbox')
      .getByRole('option')
      .filter({ hasText: applicationNumber })
      .click()

    // What the application is missing against the cart, before anything is posted.
    const diff = page.getByTestId('credit-override-diff')
    await expect(diff).toContainText(applicationNumber)
    await expect(diff).toContainText('Approved')
    await expect(diff).toContainText(`Not on the application: ${fx.items[1].name}`)

    // It is an exception like the others: a reason and a note, asked for once.
    await expect(exceptionSection(page)).toBeVisible()
    await expect(exceptionSection(page)).toContainText('Credit Application Override')
    // The button names what is still missing until every line has a term.
    const termPickers = page.getByRole('combobox', { name: 'Select a term…' })
    for (let i = 0; i < 4 && (await termPickers.count()) > 0; i++) {
      await openCustomSelect(termPickers.first())
      await page.getByRole('listbox').getByRole('option').first().click()
    }
    await fillStable(page.getByLabel('Sales Invoice No.'), `SI-CO71-F02-${Date.now()}`)
    await page
      .getByTestId('dp-payment-mode-toggle')
      .getByRole('button', { name: 'Cash', exact: true })
      .click()
    // The 10% down payment on both lines, tendered in cash with its CR.
    await fillStable(page.getByPlaceholder('0.00').first(), '50000')
    await fillStable(page.getByPlaceholder('CR Number'), `CR-CO71-F02-${Date.now()}`)
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Pick a reason for the credit application override.')).toBeVisible()
  })

  test('CO-F03: a customer with nothing to override is told so, and the sale cannot go ahead on it', async ({
    page,
  }) => {
    const name = `${PREFIX} F03 ${Date.now()}`
    const customerRes = await page.request.post('/api/crm/customers', {
      data: {
        name,
        customerType: 'individual',
        phone: `0917${Date.now().toString().slice(-7)}`,
      },
    })
    expect(customerRes.ok(), await customerRes.text()).toBeTruthy()
    createdCustomerIds.push((await customerRes.json()).id)

    await startInstallmentCart(page, name, [0])
    await expect(async () => {
      await overrideBox(page).check()
      await expect(page.getByTestId('credit-override-body')).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })

    await expect(page.getByTestId('credit-override-body')).toContainText(
      'no application that can be overridden'
    )
    await expect(page.getByRole('combobox', { name: 'No application to override' })).toBeDisabled()
  })

  test('CO-F04: an application not approved yet can be overridden — it posts, and waits in the end-of-day review flagged', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await createCustomerWithApplication(
      page.request,
      'F04',
      [0],
      false
    )
    await startInstallmentCart(page, customer.name, [0])
    const salesInvoiceNumber = `SI-CO71-F04-${Date.now()}`

    await expect(async () => {
      await overrideBox(page).check()
      await expect(page.getByTestId('credit-override-body')).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
    const picker = page.getByRole('combobox', { name: 'Select the application to override…' })
    await openCustomSelect(picker)
    await page
      .getByRole('listbox')
      .getByRole('option')
      .filter({ hasText: applicationNumber })
      .click()
    const diff = page.getByTestId('credit-override-diff')
    await expect(diff).toContainText('Draft')
    await expect(diff).toContainText('Not approved yet')

    // The plan, typed with nothing down (the same route the typed-terms spec uses),
    // so no term has to be chosen.
    await page.getByTestId('type-terms').click()
    const panel = page.getByTestId('typed-plan')
    await panel.getByLabel('Typed down payment').fill('0')
    await page.getByTestId('use-covering-monthly').click()
    await panel.getByLabel('Typed months').fill('3')
    await page.getByTestId('use-covering-monthly').click()
    await expect(page.getByTestId('typed-plan-problem')).toHaveCount(0)

    const section = exceptionSection(page)
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await fillStable(
      section.getByLabel('Note for the price override or typed terms'),
      'Application still with the investigator'
    )
    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    await page
      .getByTestId('dp-payment-mode-toggle')
      .getByRole('button', { name: 'Cash', exact: true })
      .click()

    // Not clickStable — this submits a real sale.
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 25_000,
    })

    // What posted: flagged, the application linked and still a draft.
    const listRes = await page.request.get('/api/pos/transactions', {
      params: { search: salesInvoiceNumber },
    })
    const listBody = await listRes.json()
    const sale = (
      (listBody.data ?? listBody) as { id: string; salesInvoiceNumber: string | null }[]
    ).find((t) => t.salesInvoiceNumber === salesInvoiceNumber)!
    const detail = await (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
    expect(detail.creditApplicationOverridden).toBe(true)
    expect(detail.exception.creditOverride).toMatchObject({
      applicationNumber,
      applicationStatus: 'draft',
    })

    // And it is waiting for the manager, with the flag and what differed.
    const day = await (
      await page.request.get('/api/pos/override-review', {
        params: { date: new Date().toISOString().slice(0, 10), branchId: fx.branchId },
      })
    ).json()
    let entry = (day.entries as { transactionId: string; flags: string[]; status: string }[]).find(
      (e) => e.transactionId === sale.id
    )
    if (!entry) {
      // The review day rolls past a day already signed off.
      for (let offset = 1; offset < 30 && !entry; offset++) {
        const d = new Date()
        d.setDate(d.getDate() + offset)
        const next = await (
          await page.request.get('/api/pos/override-review', {
            params: { date: d.toISOString().slice(0, 10), branchId: fx.branchId },
          })
        ).json()
        entry = (next.entries as { transactionId: string; flags: string[]; status: string }[]).find(
          (e) => e.transactionId === sale.id
        )
      }
    }
    expect(entry).toBeTruthy()
    expect(entry!.flags).toContain('credit_overridden')
    expect(entry!.status).toBe('pending')
  })
})
