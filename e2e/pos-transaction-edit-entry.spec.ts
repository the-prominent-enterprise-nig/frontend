import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable, loginAs } from './utils'

// Docket #49: the Business Owner and the Sales Admin Clerk (the server test
// pos-edit-recorded-sale covers the clerk) click Edit entry on a sale, and its
// Invoice Date, Agent, Credit, Commission and SMI turn into inputs where they
// are in the transaction modal, with Save below. A saved edit only changes the
// POS Sales Report: the sale keeps what it recorded, and the modal notes the
// edit under the field. Branch staff don't see the button.
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

/** A unit in stock at the branch, of a priced item (the stock items here are
 * serial-tracked, so a sale takes one real unit). */
async function unitInStock(page: Page, branchId: string) {
  const body = await (
    await page.request.get('/api/inventory/serial-numbers', {
      params: { branchIds: branchId, status: 'in_stock', limit: '200' },
    })
  ).json()
  for (const unit of (body.data ?? []) as { id: string; itemId: string }[]) {
    const item = await (await page.request.get(`/api/inventory/items/${unit.itemId}`)).json()
    const price = Number(item.sellingPrice)
    if (price >= 1000) {
      return { id: item.id as string, name: item.name as string, price, serialNumberId: unit.id }
    }
  }
  throw new Error('No priced unit in stock at the branch')
}

async function saleWithAgentAndPayment(page: Page, stamp: number, opts: { dr?: boolean } = {}) {
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

  const unit = await unitInStock(page, bago.id)
  const si = `EE-${stamp}`
  const res = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId: await openSession(page, bago.id),
      customerId: customer.id,
      ...(opts.dr ? { deliveryReceiptNumber: si } : { salesInvoiceNumber: si }),
      sellingAgentId: firstAgent.id,
      subtotal: unit.price,
      totalAmount: unit.price,
      currency: 'PHP',
      lines: [
        {
          itemId: unit.id,
          itemName: unit.name,
          quantity: 1,
          unitPrice: unit.price,
          serialNumberId: unit.serialNumberId,
        },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const sale = await res.json()
  const pay = await page.request.post(`/api/pos/transactions/${sale.id}/payments`, {
    data: { paymentMethod: 'cash', amount: unit.price, referenceNumber: `CR-${stamp}` },
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

test('the owner changes the five fields in place; only the Sales Report figures change', async ({
  page,
}) => {
  const stamp = Date.now()
  const { id, si, firstAgent, secondAgent } = await saleWithAgentAndPayment(page, stamp)

  await gotoReady(page, `/pos/transactions/${id}`)
  const modal = page.getByTestId('transaction-modal')
  await expect(modal.getByText(firstAgent.name).first()).toBeVisible({ timeout: 15_000 })
  // The Invoice Date shows on the transaction.
  await expect(modal.getByText('Invoice Date', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refund' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit entry' }).click()

  // In place in the modal, no second pop-up, starting at the Invoice Date.
  await expect(modal.getByTestId('edit-entry-bar')).toContainText(
    'These changes only show in the POS Sales Report.'
  )
  await expect(page.getByTestId('edit-entry-invoice-date')).toBeFocused()

  // The SI / DR No. and the CR # stay as text.
  await expect(box(page, 'Sales Invoice No.')).toHaveCount(0)
  await expect(page.getByLabel(/^Reference no\./)).toHaveCount(0)

  await box(page, 'Invoice Date').fill('2026-10-05')
  await pickAgent(page, secondAgent.name)
  await fillStable(box(page, 'Credit'), '27,450')
  await fillStable(box(page, 'Commission'), '653.57')
  await fillStable(box(page, 'SMI'), '150')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Entry updated')).toBeVisible({ timeout: 15_000 })

  // The modal still reads as recorded, with each edit noted under its field.
  await expect(page.getByTestId('edit-entry-bar')).toHaveCount(0)
  await expect(modal.getByRole('heading', { level: 2 })).toHaveText(si)
  await expect(page.getByText(`Reference # CR-${stamp}`)).toBeVisible()
  await expect(modal.getByText(firstAgent.name).first()).toBeVisible()
  const notes = modal.getByTestId('report-edit-note')
  await expect(notes).toHaveCount(5)
  await expect(notes.filter({ hasText: secondAgent.name })).toHaveCount(1)
  await expect(notes.filter({ hasText: '27,450.00' })).toHaveCount(1)
  await expect(notes.filter({ hasText: '10/5/2026' })).toHaveCount(1)

  // On the server: the sale as recorded, the edits apart.
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(detail.salesInvoiceNumber).toBe(si)
  expect(detail.sellingAgent?.id).toBe(firstAgent.id)
  expect(detail.payments[0].referenceNumber).toBe(`CR-${stamp}`)
  expect(detail.reportEdit).toMatchObject({
    agentId: secondAgent.id,
    credit: 27450,
    commission: 653.57,
    smi: 150,
    invoiceDate: '2026-10-05',
  })

  // Edit entry opens again on what the report now shows.
  await page.getByRole('button', { name: 'Edit entry' }).click()
  await expect(box(page, 'Credit')).toHaveValue('27450')
  await expect(box(page, 'Invoice Date')).toHaveValue('2026-10-05')
  await expect(box(page, 'Agent')).toHaveValue(secondAgent.name)
})

test('Cancel leaves the sale as it was (edge)', async ({ page }) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp)

  await openEdit(page, id)
  await fillStable(box(page, 'Credit'), '999')
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByTestId('edit-entry-bar')).toHaveCount(0)
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(detail.reportEdit).toBeNull()

  // Opening it again starts over, not from the discarded text.
  await page.getByRole('button', { name: 'Edit entry' }).click()
  await expect(box(page, 'Credit')).toHaveValue('')
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
  await fillStable(box(page, 'Credit'), 'abc')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByTestId('edit-entry-error')).toContainText('Credit must be an amount')
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(detail.reportEdit).toBeNull()
})

test('emptying a box takes that edit back off (edge)', async ({ page }) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp)
  const modal = page.getByTestId('transaction-modal')

  await openEdit(page, id)
  await fillStable(box(page, 'Credit'), '500')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(modal.getByTestId('report-edit-note')).toHaveCount(1, { timeout: 15_000 })

  await page.getByRole('button', { name: 'Edit entry' }).click()
  await box(page, 'Credit').fill('')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(modal.getByTestId('report-edit-note')).toHaveCount(0, { timeout: 15_000 })
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
