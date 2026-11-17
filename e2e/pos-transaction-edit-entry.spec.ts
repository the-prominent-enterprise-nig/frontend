import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable, loginAs, pickSearchableOption } from './utils'

// Docket #49: the Business Owner and the Sales Admin Clerk (the server test
// pos-edit-recorded-sale covers the clerk) click Edit entry on a sale, and its
// Invoice Date and Agent turn into inputs where they are in the transaction
// modal, and (client, Nov 16) each item row's Price Used, Credit, CM and SMI
// turn into inputs in the Items table, with Save below. The card's Total
// Credit, Total Commission and Total SMI are the rows added up as they are
// typed. A saved edit only changes the POS Sales Report: the sale keeps what it
// recorded, and the modal notes the edit under the field and in purple on the
// row. Branch staff don't see the button.
//
// Setup goes through the API: a cash sale at Bago with an agent and a cash
// payment carrying a CR #.

const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'

let createdCustomerId: string | undefined
let createdAgentId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
  if (createdAgentId) {
    await page.request.delete(`/api/crm/agents/${createdAgentId}`)
    createdAgentId = undefined
  }
})

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
  const res = await page.request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()).id as string
}

/** Units in stock at the branch, of priced items (the stock items here are
 * serial-tracked, so a sale takes real units). */
async function unitsInStock(page: Page, branchId: string, count: number) {
  const body = await (
    await page.request.get('/api/inventory/serial-numbers', {
      params: { branchIds: branchId, status: 'in_stock', limit: '200' },
    })
  ).json()
  const found: { id: string; name: string; price: number; serialNumberId: string }[] = []
  for (const unit of (body.data ?? []) as { id: string; itemId: string }[]) {
    const item = await (await page.request.get(`/api/inventory/items/${unit.itemId}`)).json()
    const price = Number(item.sellingPrice)
    if (price >= 1000) {
      found.push({
        id: item.id as string,
        name: item.name as string,
        price,
        serialNumberId: unit.id,
      })
      if (found.length === count) return found
    }
  }
  throw new Error(`Fewer than ${count} priced units in stock at the branch`)
}

async function saleWithAgentAndPayment(
  page: Page,
  stamp: number,
  opts: { dr?: boolean; items?: number } = {}
) {
  const customer = await (
    await page.request.post('/api/crm/customers', {
      data: {
        name: `E2E EditEntry ${stamp}`,
        customerType: 'individual',
        phone: '09170002427',
      },
    })
  ).json()
  createdCustomerId = customer.id

  const branches = ((await (await page.request.get('/api/branches?limit=200')).json()).data ??
    []) as { id: string; name: string }[]
  const bago = branches.find((b) => b.name === 'Bago')!
  // An agent of this test's own, so there are always two to switch between.
  const created = await page.request.post('/api/crm/agents', {
    data: { name: `E2E EditEntry Agent ${stamp}` },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const secondAgent = (await created.json()) as { id: string; name: string }
  createdAgentId = secondAgent.id
  const agentsBody = await (
    await page.request.get('/api/pos/agents', { params: { limit: '100' } })
  ).json()
  const firstAgent = ((agentsBody.data ?? []) as { id: string; name: string }[]).find(
    (a) => a.id !== secondAgent.id
  )!
  expect(firstAgent, 'an active agent besides ours').toBeTruthy()

  const units = await unitsInStock(page, bago.id, opts.items ?? 1)
  const total = units.reduce((n, u) => n + u.price, 0)
  const si = `EE-${stamp}`
  const res = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId: await openSession(page, bago.id),
      customerId: customer.id,
      ...(opts.dr ? { deliveryReceiptNumber: si } : { salesInvoiceNumber: si }),
      sellingAgentId: firstAgent.id,
      subtotal: total,
      totalAmount: total,
      currency: 'PHP',
      lines: units.map((unit) => ({
        itemId: unit.id,
        itemName: unit.name,
        quantity: 1,
        unitPrice: unit.price,
        serialNumberId: unit.serialNumberId,
      })),
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const sale = await res.json()
  const pay = await page.request.post(`/api/pos/transactions/${sale.id}/payments`, {
    data: { paymentMethod: 'cash', amount: total, referenceNumber: `CR-${stamp}` },
  })
  expect(pay.ok(), await pay.text()).toBeTruthy()
  return { id: sale.id as string, si, firstAgent, secondAgent }
}

async function pickAgent(page: Page, name: string): Promise<void> {
  await page.getByLabel('Agent', { exact: true }).click()
  await page.getByTestId('searchable-select-option').filter({ hasText: name }).first().click()
}

const openEdit = async (page: Page, id: string): Promise<void> => {
  await gotoReady(page, `/pos/transactions/${id}`)
  await page.getByRole('button', { name: 'Edit entry' }).click({ timeout: 15_000 })
}

const box = (page: Page, name: string) => page.getByLabel(name, { exact: true })

/** The Price Used a sale line could be edited to: any the catalogue offers. */
async function aPriceUse(page: Page): Promise<string> {
  const uses = (await (await page.request.get('/api/pos/catalog/price-use-types')).json()) as {
    name: string
  }[]
  expect(uses.length, 'a Price Used on offer').toBeGreaterThan(0)
  return uses[0].name
}

test('the owner changes the date, agent and the item row in place; only the Sales Report figures change', async ({
  page,
}) => {
  const stamp = Date.now()
  const { id, si, firstAgent, secondAgent } = await saleWithAgentAndPayment(page, stamp)
  const priceUse = await aPriceUse(page)

  await gotoReady(page, `/pos/transactions/${id}`)
  const modal = page.getByTestId('transaction-modal')
  await expect(modal.getByText(firstAgent.name).first()).toBeVisible({ timeout: 15_000 })
  // The Invoice Date shows on the transaction, and the Items table has the
  // client's columns: Credit, then CM, then SMI.
  await expect(modal.getByText('Invoice Date', { exact: true })).toBeVisible()
  const heads = modal.getByRole('columnheader')
  await expect(heads.nth(-3)).toHaveText('Credit')
  await expect(heads.nth(-2)).toHaveText('CM')
  await expect(heads.nth(-1)).toHaveText('SMI')
  await expect(page.getByRole('button', { name: 'Refund' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit entry' }).click()

  // In place in the modal, no second pop-up, starting at the Invoice Date.
  await expect(modal.getByTestId('edit-entry-bar')).toContainText(
    'These changes only show in the POS Sales Report.'
  )
  await expect(page.getByTestId('edit-entry-invoice-date')).toBeFocused()

  // The SI / DR No. and the CR # stay as text, and so do the card's totals.
  await expect(box(page, 'Sales Invoice No.')).toHaveCount(0)
  await expect(page.getByLabel(/^Reference no\./)).toHaveCount(0)
  await expect(box(page, 'Total Credit')).toHaveCount(0)

  await box(page, 'Invoice Date').fill('2026-10-05')
  await pickAgent(page, secondAgent.name)
  await pickSearchableOption(page, 'Price Used (item 1)', priceUse)
  await fillStable(box(page, 'Credit (item 1)'), '27,450')
  await fillStable(box(page, 'CM (item 1)'), '653.57')
  await fillStable(box(page, 'SMI (item 1)'), '150')
  // The card's totals follow the row as it is typed.
  await expect(page.getByTestId('total-credit')).toHaveText('₱27,450.00')
  await expect(page.getByTestId('total-commission')).toHaveText('₱653.57')
  await expect(page.getByTestId('total-smi')).toHaveText('₱150.00')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Entry updated')).toBeVisible({ timeout: 15_000 })

  // The modal still reads as recorded, with each edit noted: the card's under
  // its field, the row's in purple under the recorded figure.
  await expect(page.getByTestId('edit-entry-bar')).toHaveCount(0)
  await expect(modal.getByRole('heading', { level: 2 })).toHaveText(si)
  await expect(page.getByText(`Reference # CR-${stamp}`)).toBeVisible()
  await expect(modal.getByText(firstAgent.name).first()).toBeVisible()
  const notes = modal.getByTestId('report-edit-note')
  await expect(notes).toHaveCount(5)
  await expect(notes.filter({ hasText: secondAgent.name })).toHaveCount(1)
  await expect(notes.filter({ hasText: '27,450.00' })).toHaveCount(1)
  await expect(notes.filter({ hasText: '653.57' })).toHaveCount(1)
  await expect(notes.filter({ hasText: '10/5/2026' })).toHaveCount(1)
  const rowNotes = modal.getByTestId('line-edit-note')
  await expect(rowNotes).toHaveCount(4)
  await expect(rowNotes.filter({ hasText: priceUse })).toHaveCount(1)
  await expect(rowNotes.filter({ hasText: '27,450.00' })).toHaveCount(1)

  // On the server: the sale as recorded, the edits apart and per row.
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(detail.salesInvoiceNumber).toBe(si)
  expect(detail.sellingAgent?.id).toBe(firstAgent.id)
  expect(detail.payments[0].referenceNumber).toBe(`CR-${stamp}`)
  expect(detail.reportEdit).toMatchObject({
    agentId: secondAgent.id,
    // Nothing is sale-level any more: the totals are the rows added up.
    credit: null,
    commission: null,
    smi: null,
    invoiceDate: '2026-10-05',
  })
  const lineId = detail.lines[0].id as string
  expect(detail.reportEdit.lines[lineId]).toMatchObject({
    priceUseName: priceUse,
    credit: 27450,
    commission: 653.57,
    smi: 150,
  })

  // Edit entry opens again on what the report now shows.
  await page.getByRole('button', { name: 'Edit entry' }).click()
  await expect(box(page, 'Credit (item 1)')).toHaveValue('27450')
  await expect(box(page, 'CM (item 1)')).toHaveValue('653.57')
  await expect(box(page, 'Invoice Date')).toHaveValue('2026-10-05')
  await expect(box(page, 'Agent')).toHaveValue(secondAgent.name)
  await expect(box(page, 'Price Used (item 1)')).toHaveValue(priceUse)
})

test('two items: each row is edited on its own and the card adds them up (Nov 16)', async ({
  page,
}) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp, { items: 2 })

  await openEdit(page, id)
  await fillStable(box(page, 'Credit (item 1)'), '1000')
  await fillStable(box(page, 'Credit (item 2)'), '250.50')
  await fillStable(box(page, 'CM (item 2)'), '40')
  await expect(page.getByTestId('total-credit')).toHaveText('₱1,250.50')
  await expect(page.getByTestId('total-commission')).toHaveText('₱40.00')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Entry updated')).toBeVisible({ timeout: 15_000 })

  // Nothing was divided: each row holds what was typed for it, row 1 has no CM.
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  const [first, second] = detail.lines as { id: string }[]
  expect(detail.reportEdit.lines[first.id]).toMatchObject({ credit: 1000, commission: null })
  expect(detail.reportEdit.lines[second.id]).toMatchObject({ credit: 250.5, commission: 40 })
  const modal = page.getByTestId('transaction-modal')
  await expect(modal.getByTestId('total-credit').locator('..')).toContainText('1,250.50')

  // Changing one row later leaves the other row's edit alone.
  await page.getByRole('button', { name: 'Edit entry' }).click()
  await fillStable(box(page, 'Credit (item 1)'), '1500')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Entry updated').first()).toBeVisible({ timeout: 15_000 })
  const after = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(after.reportEdit.lines[first.id].credit).toBe(1500)
  expect(after.reportEdit.lines[second.id]).toMatchObject({ credit: 250.5, commission: 40 })
})

test('the Sales Report tab lists Credit, then Commission, then SMI (Nov 16)', async ({ page }) => {
  await gotoReady(page, '/pos/reports?tab=report')
  await expect(page.getByRole('heading', { name: 'Sales Report', level: 2 })).toBeVisible({
    timeout: 20_000,
  })
  const heads = page.getByRole('columnheader')
  await expect(heads.nth(-3)).toHaveText('Credit')
  await expect(heads.nth(-2)).toHaveText('Commission')
  await expect(heads.nth(-1)).toHaveText('SMI')
})

test('Cancel leaves the sale as it was (edge)', async ({ page }) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp)

  await openEdit(page, id)
  await fillStable(box(page, 'Credit (item 1)'), '999')
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByTestId('edit-entry-bar')).toHaveCount(0)
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(detail.reportEdit).toBeNull()

  // Opening it again starts over, not from the discarded text.
  await page.getByRole('button', { name: 'Edit entry' }).click()
  await expect(box(page, 'Credit (item 1)')).toHaveValue('')
})

test('saving with nothing changed says so instead of writing an empty edit (edge)', async ({
  page,
}) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp)

  await openEdit(page, id)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByTestId('edit-entry-error')).toContainText('Nothing has been changed yet.')
})

test('a cashier and a branch manager see no Edit entry and are refused', async ({
  browser,
  page,
}) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp)

  for (const email of ['technova.b1.cashier@test.com', 'technova.b1.manager@test.com']) {
    const context = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3010',
      storageState: undefined,
    })
    const other = await context.newPage()
    await loginAs(other, email, PASSWORD)
    await gotoReady(other, `/pos/transactions/${id}`)
    await expect(other.getByRole('heading', { level: 2 })).toBeVisible({ timeout: 15_000 })
    await expect(other.getByRole('button', { name: 'Edit entry' })).toHaveCount(0)
    // And the server refuses them too.
    const res = await other.request.patch(`/api/pos/transactions/${id}/recorded`, {
      data: { credit: 1 },
    })
    expect(res.status(), email).toBe(403)
    await context.close()
  }
})

// ── More edge cases ──────────────────────────────────────────────────────

test('an amount that is not one is refused before anything is sent (edge)', async ({ page }) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp)

  await openEdit(page, id)
  await fillStable(box(page, 'Credit (item 1)'), 'abc')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByTestId('edit-entry-error')).toContainText('Credit must be an amount')
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(detail.reportEdit).toBeNull()
})

test("emptying a row's box takes that edit back off (edge)", async ({ page }) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp)
  const modal = page.getByTestId('transaction-modal')

  await openEdit(page, id)
  await fillStable(box(page, 'Credit (item 1)'), '500')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(modal.getByTestId('line-edit-note')).toHaveCount(1, { timeout: 15_000 })
  await expect(modal.getByTestId('report-edit-note')).toHaveCount(1)

  await page.getByRole('button', { name: 'Edit entry' }).click()
  await box(page, 'Credit (item 1)').fill('')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(modal.getByTestId('line-edit-note')).toHaveCount(0, { timeout: 15_000 })
  await expect(modal.getByTestId('report-edit-note')).toHaveCount(0)
})

test('a refund has no Edit entry (edge)', async ({ page }) => {
  const body = await (
    await page.request.get('/api/pos/transactions', { params: { transactionType: 'refund' } })
  ).json()
  const refund = ((body.data ?? body) as { id: string }[])[0]
  test.skip(!refund, 'no refund on this database')

  await gotoReady(page, `/pos/transactions/${refund.id}`)
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Edit entry' })).toHaveCount(0)
})
