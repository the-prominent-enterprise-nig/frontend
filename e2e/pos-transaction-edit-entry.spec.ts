import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable, loginAs } from './utils'

// Ticket #24 follow-up (client comment, Nov 9): the mockup of a transaction
// page has "Edit entry" beside Refund, and "it is not editable". The Business
// Owner clicks Edit entry and the sale's own fields turn into inputs on the
// page — the SI / DR No., the agent, each payment's reference no. — with
// Save below. Nobody else sees the button.
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

async function saleWithAgentAndPayment(page: Page, stamp: number) {
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
      salesInvoiceNumber: si,
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

test('the owner edits the SI No., agent and CR # on the page itself and saves', async ({
  page,
}) => {
  const stamp = Date.now()
  const { id, si, firstAgent, secondAgent } = await saleWithAgentAndPayment(page, stamp)

  await gotoReady(page, `/pos/transactions/${id}`)
  await expect(page.getByText(firstAgent.name).first()).toBeVisible({ timeout: 15_000 })
  // Beside Refund, as in the mockup.
  await expect(page.getByRole('button', { name: 'Refund' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit entry' }).click()

  // In place on the page — no pop-up — with Save below.
  await expect(page.locator('main').getByTestId('edit-entry-bar')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refund' })).toHaveCount(0)
  const docNo = page.getByLabel('Sales Invoice No.', { exact: true })
  await expect(docNo).toHaveValue(si)

  await fillStable(docNo, `${si}-FIXED`)
  await pickAgent(page, secondAgent.name)
  const cr = page.getByLabel(/^Reference no\. for the cash payment/)
  await expect(cr).toHaveValue(`CR-${stamp}`)
  await fillStable(cr, `CR-${stamp}-B`)

  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Entry updated')).toBeVisible({ timeout: 15_000 })

  // Back to reading: the new values show, and Refund / Edit entry are back.
  await expect(page.getByTestId('edit-entry-bar')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`${si}-FIXED`)
  await expect(page.getByText(secondAgent.name).first()).toBeVisible()
  await expect(page.getByText(`CR# CR-${stamp}-B`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit entry' })).toBeVisible()

  // Saved on the server, and the list finds the sale by its new number.
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(detail.salesInvoiceNumber).toBe(`${si}-FIXED`)
  expect(detail.sellingAgent?.id).toBe(secondAgent.id)
  expect(detail.payments[0].referenceNumber).toBe(`CR-${stamp}-B`)
  await gotoReady(page, '/pos/transactions')
  await fillStable(page.getByPlaceholder('Search…'), `${si}-FIXED`)
  await expect(page.locator('tbody tr', { hasText: `${si}-FIXED` })).toBeVisible({
    timeout: 15_000,
  })
})

test('Cancel leaves the sale as it was (edge)', async ({ page }) => {
  const stamp = Date.now()
  const { id, si } = await saleWithAgentAndPayment(page, stamp)

  await gotoReady(page, `/pos/transactions/${id}`)
  await page.getByRole('button', { name: 'Edit entry' }).click({ timeout: 15_000 })
  await fillStable(page.getByLabel('Sales Invoice No.', { exact: true }), 'SHOULD-NOT-SAVE')
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByTestId('edit-entry-bar')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(si)
  const detail = await (await page.request.get(`/api/pos/transactions/${id}`)).json()
  expect(detail.salesInvoiceNumber).toBe(si)

  // Opening it again starts from the sale as recorded, not the discarded text.
  await page.getByRole('button', { name: 'Edit entry' }).click()
  await expect(page.getByLabel('Sales Invoice No.', { exact: true })).toHaveValue(si)
})

test('saving with nothing changed says so instead of writing an empty edit (edge)', async ({
  page,
}) => {
  const stamp = Date.now()
  const { id } = await saleWithAgentAndPayment(page, stamp)

  await gotoReady(page, `/pos/transactions/${id}`)
  await page.getByRole('button', { name: 'Edit entry' }).click({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByTestId('edit-entry-error')).toContainText('Nothing has been changed yet.')
})

test('a cashier and a branch manager see Refund but no Edit entry', async ({ browser, page }) => {
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
      data: { documentNumber: 'X' },
    })
    expect(res.status(), email).toBe(403)
    await context.close()
  }
})
