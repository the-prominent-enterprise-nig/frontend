import { test, expect } from '@playwright/test'
import { gotoReady, pickFromSearchCombobox } from './utils'

// Docket #94 audit, Group 4 — serial pickers.
//
// The Debit Memo's "Specific replacement serial" box loaded the first 500
// in-stock units of the item and filtered THOSE as you typed. An item can have
// more than that (the seed's biggest has 1,080), so a unit past the 500 could
// never be chosen. Now what is typed goes to the server.
//
// Takes the OLDEST in-stock unit of the item with the most units — the list is
// newest-first, so it is the last thing a 500-row page would ever reach.

let customerId: string | undefined

test.afterEach(async ({ page }) => {
  if (customerId) {
    await page.request.delete(`/api/crm/customers/${customerId}`)
    customerId = undefined
  }
})

test('Debit Memo: a serial past the first 500 units of the item can be picked', async ({
  page,
}) => {
  // The item with the most in-stock units, and its oldest one.
  const balances = (await (
    await page.request.get('/api/inventory/items', { params: { limit: '1', sortBy: 'createdAt' } })
  ).json()) as { data: { id: string }[] }
  expect(balances.data.length).toBeGreaterThan(0)

  const serialsRes = await page.request.get('/api/inventory/serial-numbers', {
    params: { status: 'in_stock', limit: '1' },
  })
  const serialsBody = (await serialsRes.json()) as { meta?: { total?: number }; total?: number }
  expect(serialsBody.meta?.total ?? serialsBody.total ?? 0).toBeGreaterThan(500)

  // Find an item with more than 500 in-stock units by walking the ledger's
  // own per-item counts: take the item of the 501st-newest unit overall, then
  // confirm that item really has more than 500.
  type Sn = { serialNumber: string; item?: { id: string; name: string; sku: string } | null }
  let target: { itemId: string; name: string; sku: string; oldestSerial: string } | undefined
  const candidates = (await (
    await page.request.get('/api/inventory/serial-numbers', {
      params: { status: 'in_stock', limit: '200' },
    })
  ).json()) as { data: Sn[] }
  const seen = new Set<string>()
  for (const s of candidates.data) {
    const item = s.item
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    const counted = (await (
      await page.request.get('/api/inventory/serial-numbers', {
        params: { status: 'in_stock', itemId: item.id, limit: '1' },
      })
    ).json()) as { meta?: { total?: number }; total?: number }
    const total = counted.meta?.total ?? counted.total ?? 0
    if (total > 500) {
      const last = (await (
        await page.request.get('/api/inventory/serial-numbers', {
          params: { status: 'in_stock', itemId: item.id, limit: '1', page: String(total) },
        })
      ).json()) as { data: Sn[] }
      target = {
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        oldestSerial: last.data[0].serialNumber,
      }
      break
    }
  }
  expect(target, 'an item with more than 500 in-stock serials').toBeTruthy()

  // A sent invoice to issue the memo against.
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: `E2E Serial Picker ${Date.now()}`,
      customerType: 'individual',
      phone: '09170007711',
    },
  })
  customerId = ((await customerRes.json()) as { id: string }).id
  const invoice = (await (
    await page.request.post('/api/ar-invoices', {
      data: {
        customerId,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        description: 'E2E serial picker fixture',
        subtotal: 1000,
        taxAmount: 0,
      },
    })
  ).json()) as { id: string; invoiceNumber: string }
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customerId}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.getByLabel('Issue debit memo').click()
  await expect(page.getByRole('heading', { name: 'Issue Debit Memo' })).toBeVisible({
    timeout: 10_000,
  })

  await pickFromSearchCombobox(
    page,
    'Search item by name or SKU…',
    target!.sku,
    target!.sku,
    target!.name
  )
  // The serial box appears for a serial-tracked item. Its oldest unit is past
  // the first 500; typing the tail of it finds it.
  await pickFromSearchCombobox(
    page,
    'Search serial number…',
    target!.oldestSerial.slice(-8),
    target!.oldestSerial,
    target!.oldestSerial
  )
})
