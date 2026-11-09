import { test, expect, type Locator, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

/** Status is the same searchable picker as Invoice Type and Branch. */
async function pickStatus(page: Page, label: string): Promise<void> {
  await page.getByLabel('Status', { exact: true }).click()
  await page
    .getByTestId('searchable-select-option')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click()
}

// Ticket #24 follow-up (client comments, Nov 9) on POS → Sales Counter →
// Transactions:
//   1. "add column for invoice type, example cash or installment"
//   2. "when we view one invoice and click back to Transactions, all filters
//      are removed. You have to filter again."
//
// Setup goes through the API, like pos-transactions-branch-filter-page.spec.ts:
// a cash sale at Bago and at Antique, and an in-house installment sale at Bago.

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

interface Item {
  id: string
  name: string
  sellingPrice: number
  /** The stock items here are serial-tracked: each sale takes one real unit. */
  serialNumberId: string
}

async function openSession(page: Page, branchId: string): Promise<string> {
  const terminals = (await (
    await page.request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await page.request.get('/api/pos/sessions', {
      params: { terminalId: terminal.id, status: 'open' },
    })
  ).json()) as { id: string }[]
  if (open.length > 0) return open[0].id
  const openRes = await page.request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(openRes.ok(), await openRes.text()).toBeTruthy()
  return (await openRes.json()).id as string
}

/** n units in stock at the branch, each of a different priced item. */
async function unitsInStock(page: Page, branchId: string, n: number): Promise<Item[]> {
  const body = await (
    await page.request.get('/api/inventory/serial-numbers', {
      params: { branchIds: branchId, status: 'in_stock', limit: '200' },
    })
  ).json()
  const units: Item[] = []
  for (const unit of (body.data ?? []) as { id: string; itemId: string }[]) {
    if (units.some((u) => u.id === unit.itemId)) continue
    const item = await (await page.request.get(`/api/inventory/items/${unit.itemId}`)).json()
    const price = Number(item.sellingPrice) // decimals arrive as strings
    if (!(price >= 1000)) continue
    units.push({ id: item.id, name: item.name, sellingPrice: price, serialNumberId: unit.id })
    if (units.length === n) break
  }
  expect(units, `in-stock units at branch ${branchId}`).toHaveLength(n)
  return units
}

async function cashSale(
  page: Page,
  input: { sessionId: string; customerId: string; si: string; item: Item }
): Promise<string> {
  const res = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId: input.sessionId,
      customerId: input.customerId,
      salesInvoiceNumber: input.si,
      subtotal: input.item.sellingPrice,
      totalAmount: input.item.sellingPrice,
      currency: 'PHP',
      lines: [
        {
          itemId: input.item.id,
          itemName: input.item.name,
          quantity: 1,
          unitPrice: input.item.sellingPrice,
          serialNumberId: input.item.serialNumberId,
        },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()).id as string
}

/** An approved credit application, then the in-house installment sale on it. */
async function inhouseInstallmentSale(
  page: Page,
  input: {
    sessionId: string
    branchId: string
    customer: { id: string; coMakers: { id: string }[] }
    si: string
    item: Item
  }
): Promise<string> {
  const appRes = await page.request.post('/api/credit/applications', {
    data: {
      branchId: input.branchId,
      applicantCustomerId: input.customer.id,
      coMakerId: input.customer.coMakers[0].id,
      items: [{ itemId: input.item.id }],
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
  // Submitting as the Business Owner approves it outright; on a stack where
  // it still waits for investigation and a decision, take it through those.
  const after = await (await page.request.get(`/api/credit/applications/${application.id}`)).json()
  if (after.status !== 'approved') {
    await page.request.post(`/api/credit/applications/${application.id}/investigation/start`)
    await page.request.post(`/api/credit/applications/${application.id}/investigation`, {
      data: { affordabilityOutcome: 'recommend_approve', notes: 'E2E fixture' },
    })
    const decideRes = await page.request.patch(
      `/api/credit/applications/${application.id}/decide`,
      {
        data: {
          approveItemIds: (application.items as { id: string }[]).map((i) => i.id),
          declineItemIds: [],
        },
      }
    )
    expect(decideRes.ok(), await decideRes.text()).toBeTruthy()
  }

  const terms = await (await page.request.get('/api/pos/financing-terms')).json()
  const term = ((terms.data ?? terms) as { id: string; termMonths: number }[]).find(
    (t) => t.termMonths === 3
  )!
  const price = input.item.sellingPrice
  const res = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId: input.sessionId,
      customerId: input.customer.id,
      invoiceType: 'installment',
      salesInvoiceNumber: input.si,
      financingTermId: term.id,
      creditApplicationId: application.id,
      subtotal: price,
      totalAmount: price,
      currency: 'PHP',
      lines: [
        {
          itemId: input.item.id,
          itemName: input.item.name,
          quantity: 1,
          unitPrice: price,
          downPayment: Math.round(price * 0.25 * 100) / 100,
          serialNumberId: input.item.serialNumberId,
        },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()).id as string
}

async function threeSales(page: Page, stamp: number) {
  const customer = await (
    await page.request.post('/api/crm/customers', {
      data: {
        name: `E2E T24b ${stamp}`,
        customerType: 'individual',
        phone: '09170002426',
        creditLimit: 500000,
        coMakers: [
          { name: 'E2E T24b Co-Maker', relationship: 'Spouse', contactNumber: '09171115590' },
        ],
      },
    })
  ).json()
  createdCustomerId = customer.id

  const branches = ((await (await page.request.get('/api/branches?limit=200')).json()).data ??
    []) as Branch[]
  const bago = branches.find((b) => b.name === 'Bago')!
  const antique = branches.find((b) => b.name === 'Antique')!
  const bagoSession = await openSession(page, bago.id)
  const [bagoCashUnit, bagoPlanUnit] = await unitsInStock(page, bago.id, 2)
  const [antiqueCashUnit] = await unitsInStock(page, antique.id, 1)

  const si = (suffix: string) => `T24B-${stamp}-${suffix}`
  const cashBago = await cashSale(page, {
    sessionId: bagoSession,
    customerId: customer.id,
    si: si('2'),
    item: bagoCashUnit,
  })
  const cashAntique = await cashSale(page, {
    sessionId: await openSession(page, antique.id),
    customerId: customer.id,
    si: si('10'),
    item: antiqueCashUnit,
  })
  const planBago = await inhouseInstallmentSale(page, {
    sessionId: bagoSession,
    branchId: bago.id,
    customer,
    si: si('3'),
    item: bagoPlanUnit,
  })
  return { bago, antique, si, cashBago, cashAntique, planBago }
}

/** The Branch picker is a searchable text box showing the picked branch. */
const branchBox = (page: Page) => page.getByLabel('Branch', { exact: true })
const rowOf = (page: Page, si: string) => page.locator('tbody tr', { hasText: si })
const listedDocNos = async (page: Page): Promise<string[]> =>
  (await page.locator('tbody tr td:first-child').allInnerTexts()).map((s) => s.trim())

async function pickBranch(page: Page, name: string): Promise<void> {
  await page.getByLabel('Branch', { exact: true }).click()
  await page.getByTestId('searchable-select-option').filter({ hasText: name }).first().click()
}

test('the filters, Apply and Clear sit on one row, and Type / Invoice Type / Branch / Status are the same picker', async ({
  page,
}) => {
  // A common laptop screen with the sidebar open, as in the mockup.
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoReady(page, '/pos/transactions')
  const search = page.getByPlaceholder('Search…')
  await expect(search).toBeVisible({ timeout: 15_000 })

  const pickers = ['Type', 'Invoice Type', 'Branch', 'Status'].map((name) =>
    page.getByLabel(name, { exact: true })
  )
  for (const picker of pickers) {
    await expect(picker).toBeVisible()
    // The searchable picker is a text box; a plain dropdown would be a <select>.
    expect(await picker.evaluate((el) => el.tagName)).toBe('INPUT')
  }

  const top = async (l: Locator): Promise<number> => (await l.boundingBox())!.y
  const allOnOneRow = async (): Promise<void> => {
    const row = await top(search)
    for (const l of [
      ...pickers,
      page.locator('input[type="date"]').first(),
      page.locator('input[type="date"]').last(),
      page.getByRole('button', { name: 'Apply' }),
      page.getByRole('button', { name: 'Clear' }),
    ]) {
      // Same row: the controls line up (bottom-aligned, so within a few px).
      expect(Math.abs((await top(l)) - row)).toBeLessThan(8)
    }
  }
  await allOnOneRow()
  // The longest choices picked: the boxes keep their width, so still one row.
  await page.getByLabel('Invoice Type', { exact: true }).click()
  await page
    .getByTestId('searchable-select-option')
    .filter({ hasText: /^In-house$/ })
    .click()
  await pickStatus(page, 'Completed')
  await allOnOneRow()
  await page
    .getByRole('button', { name: 'Clear' })
    .locator('..')
    .screenshot({ path: 'test-results/pos-transactions-filter-row.png' })
})

test('the list shows each sale’s invoice type: Cash, or Installment (In-house)', async ({
  page,
}) => {
  const stamp = Date.now()
  const { si } = await threeSales(page, stamp)

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24B-${stamp}`)
  await expect(rowOf(page, si('3'))).toBeVisible({ timeout: 15_000 })

  await expect(page.getByRole('columnheader', { name: 'Invoice Type' })).toBeVisible()
  await expect(rowOf(page, si('2')).getByTestId('invoice-type')).toHaveText('Cash')
  await expect(rowOf(page, si('10')).getByTestId('invoice-type')).toHaveText('Cash')
  await expect(rowOf(page, si('3')).getByTestId('invoice-type')).toHaveText(
    'Installment (In-house)'
  )
  // Beside the sale / refund / exchange Type, not instead of it.
  await expect(rowOf(page, si('3'))).toContainText('sale')
})

test('the Invoice Type filter narrows the list to cash or installment sales, and is kept on the way back', async ({
  page,
}) => {
  const stamp = Date.now()
  const { si } = await threeSales(page, stamp)
  const invoiceTypeSelect = page.getByLabel('Invoice Type', { exact: true })
  const pickInvoiceType = async (label: string) => {
    await invoiceTypeSelect.click()
    await page.getByTestId('searchable-select-option').filter({ hasText: label }).first().click()
  }

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24B-${stamp}`)
  await expect(rowOf(page, si('3'))).toBeVisible({ timeout: 15_000 })

  // Like Type / Status / dates, it waits for Apply.
  await pickInvoiceType('Cash')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect.poll(async () => (await listedDocNos(page)).sort()).toEqual([si('10'), si('2')])

  await pickInvoiceType('In-house')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect.poll(() => listedDocNos(page)).toEqual([si('3')])

  // None of ours is TPF.
  await pickInvoiceType('TPF')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('No transactions found.')).toBeVisible({ timeout: 15_000 })

  await pickInvoiceType('All installment')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect.poll(() => listedDocNos(page)).toEqual([si('3')])

  // Kept after opening the sale and coming back.
  await rowOf(page, si('3')).click()
  await expect(page.getByText('Account details', { exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('link', { name: 'Transactions', exact: true }).click()
  await expect(invoiceTypeSelect).toHaveValue('All installment', { timeout: 15_000 })
  await expect.poll(() => listedDocNos(page)).toEqual([si('3')])

  // Clear brings every type back.
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(invoiceTypeSelect).toHaveValue(/^(All)?$/)
})

test('filters, branch and sort are still set after opening a transaction and coming back', async ({
  page,
}) => {
  const stamp = Date.now()
  const { si, bago } = await threeSales(page, stamp)

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24B-${stamp}`)
  await expect(rowOf(page, si('10'))).toBeVisible({ timeout: 15_000 })

  // Narrow it the way a clerk would: one branch, completed only, sorted by SI.
  await pickBranch(page, bago.name)
  await expect(rowOf(page, si('10'))).toHaveCount(0)
  await pickStatus(page, 'Completed')
  await page.getByRole('button', { name: 'Apply' }).click()
  await page.getByTitle('Sort by SI / DR No.').click() // ascending
  await expect.poll(() => listedDocNos(page)).toEqual([si('2'), si('3')])

  // Open one, then "← Transactions".
  await rowOf(page, si('3')).click()
  await expect(page.getByText('Account details', { exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('link', { name: 'Transactions', exact: true }).click()

  // Everything is as it was left.
  await expect(page.getByPlaceholder('Search…')).toHaveValue(`T24B-${stamp}`, { timeout: 15_000 })
  await expect(branchBox(page)).toHaveValue(bago.name)
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('Completed')
  await expect.poll(() => listedDocNos(page)).toEqual([si('2'), si('3')])
})

test('the browser’s Back button and a refresh keep the filters too', async ({ page }) => {
  const stamp = Date.now()
  const { si, antique } = await threeSales(page, stamp)

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24B-${stamp}`)
  await expect(rowOf(page, si('2'))).toBeVisible({ timeout: 15_000 })
  await pickBranch(page, antique.name)
  await expect.poll(() => listedDocNos(page)).toEqual([si('10')])

  await page.getByRole('link', { name: si('10') }).click()
  await expect(page).toHaveURL(/\/pos\/transactions\/[0-9a-f-]+/, { timeout: 15_000 })
  await page.goBack()
  await expect(branchBox(page)).toHaveValue(antique.name, {
    timeout: 15_000,
  })
  await expect.poll(() => listedDocNos(page)).toEqual([si('10')])

  await page.reload()
  await expect(branchBox(page)).toHaveValue(antique.name, {
    timeout: 15_000,
  })
  await expect(page.getByPlaceholder('Search…')).toHaveValue(`T24B-${stamp}`)
  await expect.poll(() => listedDocNos(page)).toEqual([si('10')])
})

test('Clear empties the filters, and coming back after that finds the plain list', async ({
  page,
}) => {
  const stamp = Date.now()
  const { si, bago, cashBago } = await threeSales(page, stamp)

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24B-${stamp}`)
  await expect(rowOf(page, si('2'))).toBeVisible({ timeout: 15_000 })
  await pickBranch(page, bago.name)
  await page.getByTitle('Sort by SI / DR No.').click()
  await expect.poll(() => listedDocNos(page)).toEqual([si('2'), si('3')])

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByPlaceholder('Search…')).toHaveValue('')
  await expect(branchBox(page)).toHaveValue(/^(All branches)?$/)

  // Coming back from a transaction now finds the cleared list.
  await gotoReady(page, `/pos/transactions/${cashBago}`)
  await expect(page.getByText('Sale', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole('link', { name: 'Transactions', exact: true }).click()
  await expect(branchBox(page)).toHaveValue(/^(All branches)?$/, {
    timeout: 15_000,
  })
  await expect(page.getByPlaceholder('Search…')).toHaveValue('')
  await expect(page.getByTitle('Sort by SI / DR No.').locator('xpath=..')).toHaveAttribute(
    'aria-sort',
    'none'
  )
})

test('a link that brings its own search (an AR invoice’s "Sale:" link) starts fresh on it', async ({
  page,
}) => {
  const stamp = Date.now()
  const { si, antique } = await threeSales(page, stamp)

  // Leave the list narrowed to Antique…
  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24B-${stamp}`)
  await expect(rowOf(page, si('2'))).toBeVisible({ timeout: 15_000 })
  await pickBranch(page, antique.name)
  await expect.poll(() => listedDocNos(page)).toEqual([si('10')])

  // …then follow a link searching for a Bago sale: it is found, not hidden
  // behind the remembered Antique filter.
  await gotoReady(page, `/pos/transactions?search=${si('2')}`)
  await expect(page.getByPlaceholder('Search…')).toHaveValue(si('2'), { timeout: 15_000 })
  await expect(branchBox(page)).toHaveValue(/^(All branches)?$/)
  await expect.poll(() => listedDocNos(page)).toEqual([si('2')])
})

test('an old ?id= link still lands on the transaction, not on the list', async ({ page }) => {
  const stamp = Date.now()
  const { cashBago } = await threeSales(page, stamp)

  await gotoReady(page, `/pos/transactions?id=${cashBago}`)
  await expect(page).toHaveURL(new RegExp(`/pos/transactions/${cashBago}`), { timeout: 15_000 })
})

// ── More edge cases ──────────────────────────────────────────────────────

test('Invoice Type, Branch and Status together narrow the list to what all three allow', async ({
  page,
}) => {
  const stamp = Date.now()
  const { si, bago } = await threeSales(page, stamp)

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24B-${stamp}`)
  await expect(rowOf(page, si('3'))).toBeVisible({ timeout: 15_000 })

  await pickBranch(page, bago.name)
  await page.getByLabel('Invoice Type', { exact: true }).click()
  await page.getByTestId('searchable-select-option').filter({ hasText: 'Cash' }).first().click()
  await pickStatus(page, 'Completed')
  await page.getByRole('button', { name: 'Apply' }).click()
  // Bago's cash sale only: not Antique's cash sale, not Bago's installment one.
  await expect.poll(() => listedDocNos(page)).toEqual([si('2')])

  // Voided: none of ours.
  await pickStatus(page, 'Voided')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('No transactions found.')).toBeVisible({ timeout: 15_000 })
})

test('a new browser tab opens the list unfiltered; the first tab keeps its own filters (edge)', async ({
  page,
}) => {
  const stamp = Date.now()
  const { si, antique } = await threeSales(page, stamp)

  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `T24B-${stamp}`)
  await expect(rowOf(page, si('2'))).toBeVisible({ timeout: 15_000 })
  await pickBranch(page, antique.name)
  await expect.poll(() => listedDocNos(page)).toEqual([si('10')])

  const second = await page.context().newPage()
  await gotoReady(second, '/pos/transactions')
  await expect(second.getByPlaceholder('Search…')).toHaveValue('', { timeout: 15_000 })
  await expect(branchBox(second)).toHaveValue(/^(All branches)?$/)
  await second.close()

  await page.reload()
  await expect(branchBox(page)).toHaveValue(antique.name, { timeout: 15_000 })
})

test('a damaged saved filter does not break the page: the list opens unfiltered (edge)', async ({
  page,
}) => {
  await gotoReady(page, '/pos/transactions')
  await page.evaluate(() =>
    window.sessionStorage.setItem('pos.transactions.listFilters', '{not json')
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByPlaceholder('Search…')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()

  // A saved value of the wrong shape is read field by field, not trusted.
  await page.evaluate(() =>
    window.sessionStorage.setItem(
      'pos.transactions.listFilters',
      JSON.stringify({ search: 42, sort: 'sideways', filters: { invoiceType: ['x'] } })
    )
  )
  await page.reload()
  await expect(page.getByPlaceholder('Search…')).toHaveValue('', { timeout: 15_000 })
  await expect(page.getByLabel('Invoice Type', { exact: true })).toHaveValue(/^(All)?$/)
})
