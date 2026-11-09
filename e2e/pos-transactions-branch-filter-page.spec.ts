import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Ticket #24 — "As a Sales Admin Clerk, I want easy reconciling of branches
// transaction": the Transactions list gets a Branch filter + Branch column and
// a sortable SI / DR No. column, and a transaction opens as a modal over
// the list, laid out as NIG's mockup (review on frontend #312).
//
// Setup goes through the API (a plain cash sale, like the
// DR/SI specs), the same
// way pos-transaction-detail-invoices.spec.ts does.

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

interface Branch {
  id: string
  name: string
}

async function openSession(page: Page, branchId: string): Promise<string> {
  const terminalsRes = await page.request.get('/api/pos/terminals', { params: { branchId } })
  const terminals = (await terminalsRes.json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]

  // Reuse a session that is already open on the terminal — closing one needs
  // its declared cash to match the expected amount, which has nothing to do
  // with what this spec checks.
  const sessionsRes = await page.request.get('/api/pos/sessions', {
    params: { terminalId: terminal.id, status: 'open' },
  })
  const open = (await sessionsRes.json()) as { id: string }[]
  if (open.length > 0) return open[0].id

  const openRes = await page.request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(openRes.ok(), await openRes.text()).toBeTruthy()
  return (await openRes.json()).id as string
}

async function cashSale(
  page: Page,
  input: { sessionId: string; customerId: string; salesInvoiceNumber: string }
): Promise<{ id: string }> {
  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { search: 'ALM175', limit: '1' },
  })
  const item = ((await itemsRes.json()).data ?? [])[0] as {
    id: string
    name: string
    sellingPrice: number
  }
  const txRes = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId: input.sessionId,
      customerId: input.customerId,
      salesInvoiceNumber: input.salesInvoiceNumber,
      subtotal: item.sellingPrice,
      totalAmount: item.sellingPrice,
      currency: 'PHP',
      lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice }],
    },
  })
  expect(txRes.ok(), await txRes.text()).toBeTruthy()
  const created = await txRes.json()
  expect(created.status).toBe('completed')
  return { id: created.id as string }
}

async function twoBranchSales(page: Page, stamp: number) {
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: `E2E T24 ${stamp}`,
      customerType: 'individual',
      phone: '09170002424',
      creditLimit: 500000,
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as Branch[]
  const bago = branches.find((b) => b.name === 'Bago')!
  const antique = branches.find((b) => b.name === 'Antique')!

  // "2" and "10" — a plain text sort would put 10 first.
  const saleAtBago = await cashSale(page, {
    sessionId: await openSession(page, bago.id),
    customerId: customer.id,
    salesInvoiceNumber: `T24-${stamp}-2`,
  })
  const saleAtAntique = await cashSale(page, {
    sessionId: await openSession(page, antique.id),
    customerId: customer.id,
    salesInvoiceNumber: `T24-${stamp}-10`,
  })
  return { bago, antique, saleAtBago, saleAtAntique }
}

async function pickBranch(page: Page, name: string): Promise<void> {
  await page.getByLabel('Branch', { exact: true }).click()
  await page.getByTestId('searchable-select-option').filter({ hasText: name }).first().click()
}

test('a clerk narrows the list to one branch, sees each row’s branch, and can sort by SI / DR No.', async ({
  page,
}) => {
  const stamp = Date.now()
  const { bago, antique } = await twoBranchSales(page, stamp)
  const rowOf = (suffix: string) => page.locator('tr', { hasText: `T24-${stamp}-${suffix}` })

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24-${stamp}`)

  // Both branches' sales, each row naming its branch.
  await expect(rowOf('2')).toBeVisible({ timeout: 15_000 })
  await expect(rowOf('10')).toBeVisible()
  await expect(rowOf('2')).toContainText('Bago')
  await expect(rowOf('10')).toContainText('Antique')

  // Branch filter — applies on pick, no Apply click.
  await pickBranch(page, antique.name)
  await expect(rowOf('10')).toBeVisible()
  await expect(rowOf('2')).toHaveCount(0)

  await pickBranch(page, bago.name)
  await expect(rowOf('2')).toBeVisible()
  await expect(rowOf('10')).toHaveCount(0)

  await pickBranch(page, 'All branches')
  await expect(rowOf('2')).toBeVisible()
  await expect(rowOf('10')).toBeVisible()

  // SI / DR No. sort reads the number the way a person does: 2 before 10.
  const docNos = () =>
    page
      .locator('tbody tr td:first-child')
      .allInnerTexts()
      .then((cells) => cells.map((c) => c.trim()).filter((c) => c.startsWith(`T24-${stamp}`)))
  const header = page.getByRole('button', { name: /SI \/ DR No\./ })

  await header.click()
  await expect.poll(docNos).toEqual([`T24-${stamp}-2`, `T24-${stamp}-10`])
  await header.click()
  await expect.poll(docNos).toEqual([`T24-${stamp}-10`, `T24-${stamp}-2`])
})

test('a transaction opens as a modal over the list with the sale card, and the old links open it too', async ({
  page,
}) => {
  const stamp = Date.now()
  const { saleAtAntique } = await twoBranchSales(page, stamp)

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24-${stamp}-10`)
  await page.getByRole('link', { name: `T24-${stamp}-10` }).click()

  const dialog = page.getByTestId('transaction-modal')
  await expect(dialog.getByRole('heading', { name: `T24-${stamp}-10` })).toBeVisible({
    timeout: 15_000,
  })
  await expect(dialog.getByText('Sale', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Antique', { exact: true })).toBeVisible()
  // A modal (NIG's mockup): the list stays behind it, and × closes it.
  await expect(page.getByPlaceholder('Search…')).toHaveValue(`T24-${stamp}-10`)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)

  // Existing deep links (?id=… from the POS dashboard and source-document
  // links, and the old /pos/transactions/<id> page) open it the same way.
  for (const link of [
    `/pos/transactions?id=${saleAtAntique.id}`,
    `/pos/transactions/${saleAtAntique.id}`,
  ]) {
    await gotoReady(page, link)
    await expect(dialog.getByRole('heading', { name: `T24-${stamp}-10` })).toBeVisible({
      timeout: 15_000,
    })
  }
})

test('an installment sale’s page shows its account details, the credit and each item’s share', async ({
  page,
}) => {
  const stamp = Date.now()
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: `E2E T24 Plan ${stamp}`,
      customerType: 'individual',
      phone: '09170002425',
      creditLimit: 500000,
      coMakers: [
        { name: 'E2E T24 Co-Maker', relationship: 'Spouse', contactNumber: '09171115589' },
      ],
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const branches = ((await (await page.request.get('/api/branches?limit=200')).json()).data ??
    []) as Branch[]
  const bago = branches.find((b) => b.name === 'Bago')!
  const sessionId = await openSession(page, bago.id)

  const termsBody = await (await page.request.get('/api/pos/financing-terms')).json()
  const terms = (termsBody.data ?? termsBody) as { id: string; termMonths: number }[]
  const term = terms.find((t) => t.termMonths === 3) ?? terms[0]

  // Two different items, so each unit has its own price and its own share.
  const findItem = async (search: string) =>
    ((
      await (
        await page.request.get('/api/inventory/items', { params: { search, limit: '1' } })
      ).json()
    ).data ?? [])[0] as { id: string; name: string; sellingPrice: number }
  const [itemA, itemB] = [await findItem('ALM175'), await findItem('ALM191')].map((i) => ({
    ...i,
    sellingPrice: Number(i.sellingPrice), // the API sends decimals as strings
  }))

  // An approved credit application is required for any installment sale
  // (items[] and PATCH .../decide are how it is done now — see
  // ar-invoice-detail-view.spec.ts).
  const appRes = await page.request.post('/api/credit/applications', {
    data: {
      branchId: bago.id,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      items: [{ itemId: itemA.id }, { itemId: itemB.id }],
    },
  })
  expect(appRes.ok(), await appRes.text()).toBeTruthy()
  const application = await appRes.json()
  const file = await (
    await page.request.post('/api/files/upload', {
      multipart: {
        file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') },
      },
    })
  ).json()
  await page.request.post(`/api/credit/applications/${application.id}/documents`, {
    data: { fileId: file.id, documentType: 'applicant_id' },
  })
  await page.request.patch(`/api/credit/applications/${application.id}/submit`)
  await page.request.post(`/api/credit/applications/${application.id}/investigation/start`)
  await page.request.post(`/api/credit/applications/${application.id}/investigation`, {
    data: { affordabilityOutcome: 'recommend_approve', notes: 'E2E fixture' },
  })
  const decideRes = await page.request.patch(`/api/credit/applications/${application.id}/decide`, {
    data: {
      approveItemIds: (application.items as { id: string }[]).map((i) => i.id),
      declineItemIds: [],
    },
  })
  expect(decideRes.ok(), await decideRes.text()).toBeTruthy()

  const lcp = itemA.sellingPrice + itemB.sellingPrice
  // A down payment is set per line (a cart-level one would apply to each).
  const dpOf = (price: number) => Math.round(price * 0.25 * 100) / 100
  const downPayment = dpOf(itemA.sellingPrice) + dpOf(itemB.sellingPrice)
  const txRes = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId,
      customerId: customer.id,
      invoiceType: 'installment',
      salesInvoiceNumber: `T24-${stamp}-PLAN`,
      financingTermId: term.id,
      creditApplicationId: application.id,
      subtotal: lcp,
      totalAmount: lcp,
      currency: 'PHP',
      lines: [
        {
          itemId: itemA.id,
          itemName: itemA.name,
          quantity: 1,
          unitPrice: itemA.sellingPrice,
          downPayment: dpOf(itemA.sellingPrice),
        },
        {
          itemId: itemB.id,
          itemName: itemB.name,
          quantity: 1,
          unitPrice: itemB.sellingPrice,
          downPayment: dpOf(itemB.sellingPrice),
        },
      ],
    },
  })
  expect(txRes.ok(), await txRes.text()).toBeTruthy()
  const sale = await txRes.json()

  // The API hands the same figures to the page.
  const detail = await (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
  const account = detail.accountSummary
  expect(account.listedCashPrice).toBe(lcp)
  expect(account.downPayment).toBeCloseTo(downPayment, 2)
  expect(account.amountFinanced).toBeCloseTo(lcp - downPayment, 2)
  expect(account.termMonths).toEqual([3])
  const credits = Object.values(account.lineCredits) as number[]
  expect(credits).toHaveLength(2)
  expect(credits.reduce((s, c) => s + c, 0)).toBeCloseTo(lcp - downPayment, 2)

  await gotoReady(page, `/pos/transactions/${sale.id}`)
  await expect(page.getByText('Account details', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Agent and credit', { exact: true })).toBeVisible()
  const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
  const accountCard = page.locator('div', { hasText: /^Account details/ }).last()
  await expect(accountCard).toContainText(peso(lcp))
  await expect(accountCard).toContainText(peso(downPayment))
  await expect(accountCard).toContainText('3 months')
  await expect(page.getByRole('columnheader', { name: 'Credit' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Price Used' })).toBeVisible()
})
