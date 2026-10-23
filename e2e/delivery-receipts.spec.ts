import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable, pickComboboxOption, ensureItemStock, clickStable } from './utils'

// Scenario 72 — outbound Delivery Receipts.
//
// Part 2: the draft form (purpose-driven fields, issuing branch, items, the
// read-only DR number), Save draft, Submit for approval with its per-purpose
// rules checked on the form before anything is saved, and the hub tab.
//
// Part 3: the Business Owner approves a DR they raised themselves (no
// self-approval block), which drafts its DMINV memo; and rejects one with a
// reason.
//
// Part 4: the DR's DMINV memo opened from the DR, posted (the DR shows
// Posted), listed in Inventory → Debit Memos beside the supplier returns, and voided; and a
// standalone memo raised from Accounting → Debit Memos.
//
// Part 5: the printed Delivery Receipt (DRAFT-watermarked until approved,
// the chosen purpose ticked) and the printed debit memo.
//
// Part 6: an approved "sales invoice to follow" DR goes to POS with
// Proceed to POS and arrives at checkout with its customer, its held unit on
// the line, and the "Invoicing DR…" banner.
//
// Part 7: a repair ticket ready for the service center opens a "For repair
// to service center" DR from the UDS list's Create DR button, with the
// ticket's unit and provider filled in; approving it posts the DR and sends
// the ticket to the provider on the DR number.
//
// Cleanup: drafts are deleted, and any still-pending DR whose reason carries
// E2E_TAG is rejected. Approved and posted DRs are voided by the tests that
// make them.

const E2E_TAG = 'E2E-DR'
const createdDrIds: string[] = []
let departmentId: string | null = null
let departmentName = ''

async function firstPlainItemSku(page: Page): Promise<string> {
  return (await firstPlainItem(page)).sku
}

async function firstPlainItem(page: Page): Promise<{ id: string; sku: string; name: string }> {
  const res = await page.request.get('/api/inventory/items', {
    params: { limit: '100', lifecycle: 'active' },
  })
  const items = ((await res.json()).data ?? []) as {
    id: string
    sku: string
    name: string
    isSerialTracked: boolean
    isService?: boolean
    isBundle?: boolean
  }[]
  const item = items.find((i) => !i.isSerialTracked && !i.isService && !i.isBundle)
  if (!item) throw new Error('no non-serial active item in the catalog')
  return item
}

/** Opens the form and picks the first issuing branch; returns its name. */
async function openNewForm(page: Page): Promise<string> {
  await gotoReady(page, '/inventory/delivery-receipts/new')
  await expect(page.getByRole('heading', { name: 'New delivery receipt' })).toBeVisible()
  return pickComboboxOption(page, 'Select branch…')
}

async function addItem(page: Page, sku: string): Promise<void> {
  await page.getByRole('button', { name: 'Add item' }).click()
  await page
    .getByRole('button', { name: /Search item/ })
    .last()
    .click()
  const input = page.locator('input[placeholder="Search item…"]')
  await expect(input).toBeVisible({ timeout: 10_000 })
  await input.fill(sku)
  const option = page.getByRole('button', { name: new RegExp(sku) }).first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
}

/** SearchableSelect: type to filter, then click the matching option. */
async function pickOption(page: Page, placeholder: string, text: string): Promise<void> {
  const input = page.getByPlaceholder(placeholder)
  await input.click()
  await input.fill(text)
  await page.getByTestId('searchable-select-option').filter({ hasText: text }).first().click()
}

async function fillReason(page: Page, text: string): Promise<void> {
  await fillStable(page.getByPlaceholder('Why is this stock leaving?'), `${E2E_TAG} ${text}`)
}

async function saveDraftAndGetId(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Save draft' }).click()
  await page.waitForURL(/\/inventory\/delivery-receipts\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  const id = page.url().split('/').pop()!
  createdDrIds.push(id)
  return id
}

test.describe('Delivery Receipts — Scenario 72', () => {
  // The TanStack Query devtools toggle (dev-only) floats over the bottom-right
  // of the action bar and intercepts clicks on its last button — same fix as
  // manual-receiving-report.spec.ts, applied to every page load here.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent = '.tsqd-parent-container { display: none !important; }'
        document.head.appendChild(style)
      })
    })
  })

  test.beforeAll(async ({ request }) => {
    departmentName = `${E2E_TAG} Dept ${Date.now()}`
    const res = await request.post('/api/departments', { data: { name: departmentName } })
    if (res.ok()) departmentId = (await res.json()).id
  })

  test.afterAll(async ({ request }) => {
    for (const id of createdDrIds) {
      await request.delete(`/api/inventory/delivery-receipts/${id}`)
    }
    // Pending ones are rejected; approved ones voided (which also voids their
    // draft memo and releases their held units).
    for (const [status, action] of [
      ['pending_approval', 'reject'],
      ['approved', 'void'],
    ] as const) {
      const res = await request.get('/api/inventory/delivery-receipts', {
        params: { status, limit: '100' },
      })
      for (const dr of ((await res.json()).data ?? []) as { id: string }[]) {
        const detail = await (await request.get(`/api/inventory/delivery-receipts/${dr.id}`)).json()
        if (!String(detail.reason ?? '').startsWith(E2E_TAG)) continue
        await request.post(`/api/inventory/delivery-receipts/${dr.id}/${action}`, {
          data: { reason: 'E2E cleanup' },
        })
      }
    }
    if (departmentId) await request.delete(`/api/departments/${departmentId}`)
  })

  test('the hub has a Delivery Receipt tab with a New button', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=delivery-receipts')
    await expect(page.getByRole('heading', { name: 'Delivery Receipts' })).toBeVisible()
    await expect(page.getByRole('link', { name: /New delivery receipt|New/ }).first()).toBeVisible()
  })

  test('a new form has no print preview, and Cancel goes back without saving', async ({
    page,
    request,
  }) => {
    const count = async (): Promise<number> => {
      const res = await request.get('/api/inventory/delivery-receipts', { params: { limit: '1' } })
      const body = await res.json()
      return body.meta?.total ?? body.total ?? (body.data ?? []).length
    }
    const before = await count()
    await gotoReady(page, '/inventory/stock-transaction?tab=delivery-receipts')
    await openNewForm(page)
    await fillReason(page, 'cancel check')
    await expect(page.getByRole('button', { name: 'Print preview' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page).toHaveURL(/tab=delivery-receipts/)
    expect(await count()).toBe(before)
  })

  test('saves a draft, takes a DR number, and reopens it for editing', async ({ page }) => {
    const sku = await firstPlainItemSku(page)
    await openNewForm(page)
    await expect(page.getByText('Assigned on save')).toBeVisible()
    await expect(page.getByText(/Office equipment, furniture and fixtures/)).toBeVisible()
    await fillReason(page, 'monitor for HR')
    await addItem(page, sku)
    await saveDraftAndGetId(page)

    await expect(page.getByRole('heading', { name: 'Edit delivery receipt' })).toBeVisible()
    await expect(page.getByText(/^DR\d{6}$/).first()).toBeVisible()
    await expect(page.getByPlaceholder('Why is this stock leaving?')).toHaveValue(/monitor for HR/)
    await expect(page.getByRole('button', { name: 'Print preview' })).toBeVisible()
  })

  test('a serialized line takes several serials, and its quantity follows the count', async ({
    page,
    request,
  }) => {
    type Wh = { id: string; name: string; branch?: { name: string } | null }
    type Sn = { id: string; serialNumber: string; itemId?: string; item?: { id: string } | null }
    const branchLabel = await openNewForm(page)
    const warehouses = (
      await (await request.get('/api/inventory/warehouses', { params: { limit: '200' } })).json()
    ).data as Wh[]
    // The picker shows the branch's name (locationLabel), not the warehouse's.
    const wh = warehouses.find(
      (w) => (w.branch?.name ?? w.name.replace(/\s+Warehouse$/i, '')) === branchLabel
    )
    test.skip(!wh, 'could not match the picked branch to a warehouse')
    const serials = (
      await (
        await request.get('/api/inventory/serial-numbers', {
          params: { warehouseId: wh!.id, status: 'in_stock', limit: '200' },
        })
      ).json()
    ).data as Sn[]
    const byItem = new Map<string, Sn[]>()
    for (const s of serials) {
      const id = s.item?.id ?? s.itemId ?? ''
      byItem.set(id, [...(byItem.get(id) ?? []), s])
    }
    const pair = [...byItem.entries()].find(([, list]) => list.length >= 2)
    test.skip(!pair, 'no item with two in-stock serials at this branch')
    const [itemId, [first, second]] = pair!
    const item = await (await request.get(`/api/inventory/items/${itemId}`)).json()

    await fillReason(page, 'two units')
    await addItem(page, item.sku)
    const qty = page.getByLabel('Quantity')
    const picker = page.getByLabel('Serial numbers')
    const pick = async (serial: string): Promise<void> => {
      await picker.click()
      await picker.fill(serial)
      await page.getByTestId('searchable-select-option').filter({ hasText: serial }).first().click()
    }
    const setQty = async (value: string): Promise<void> => {
      await qty.click()
      await qty.fill(value)
      await qty.blur()
    }
    // Picking past the quantity raises it.
    await pick(first.serialNumber)
    await pick(second.serialNumber)
    await expect(qty).toHaveValue('2')
    // Raising the quantity keeps the serials picked.
    await setQty('3')
    await expect(picker).toHaveValue('2 of 3 serials')
    // Lowering it below them keeps the first ones picked.
    await setQty('1')
    await expect(picker).toHaveValue(first.serialNumber)
    await setQty('2')
    await pick(second.serialNumber)
    await qty.click() // closes the list, which shows the summary
    await expect(picker).toHaveValue('2 of 2 serials')

    const id = await saveDraftAndGetId(page)
    const saved = await (await request.get(`/api/inventory/delivery-receipts/${id}`)).json()
    expect(saved.lines.map((l: { serialNumberId: string }) => l.serialNumberId).sort()).toEqual(
      [first.id, second.id].sort()
    )
    // Reopened, the two backend lines are one form line again.
    await expect(page.getByLabel('Quantity')).toHaveCount(1)
    await expect(page.getByLabel('Quantity')).toHaveValue('2')
  })

  test('a raffle prize asks for the occasion, with a free-text Other', async ({ page }) => {
    await openNewForm(page)
    await pickOption(page, 'Select purpose…', 'Raffle prize')
    await pickOption(page, 'Select occasion…', 'Other')
    await expect(page.getByPlaceholder('e.g. Anniversary Party')).toBeVisible()
  })

  test('submit checks the purpose rules on the form before saving anything', async ({ page }) => {
    const sku = await firstPlainItemSku(page)
    await openNewForm(page)
    await fillReason(page, 'no department yet')
    await addItem(page, sku)
    await page.getByRole('button', { name: 'Submit for approval' }).click()
    await expect(page.getByText('Which department will use it?')).toBeVisible()
    await expect(page).toHaveURL(/\/delivery-receipts\/new$/)
  })

  test('a complete office-use DR submits and shows Pending approval', async ({ page }) => {
    test.skip(!departmentId, 'could not create a department fixture')
    const sku = await firstPlainItemSku(page)
    await openNewForm(page)
    await pickOption(page, 'Select department…', departmentName)
    await fillReason(page, 'office monitor, submitted')
    await addItem(page, sku)
    await page.getByRole('button', { name: 'Submit for approval' }).click()
    await page.waitForURL(/\/inventory\/delivery-receipts\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    createdDrIds.push(page.url().split('/').pop()!)
    await expect(page.getByText('Pending approval')).toBeVisible()
    await expect(page.getByText(departmentName)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0)
  })

  /** Fills and submits a DR from the form; returns its id. */
  /** Fills and submits a DR from the form; returns its id, branch and item. */
  async function submitFromForm(
    page: Page,
    purpose: string,
    reason: string
  ): Promise<{ id: string; branch: string; itemName: string }> {
    const { sku, name } = await firstPlainItem(page)
    const branch = await openNewForm(page)
    if (purpose !== 'Office use') await pickOption(page, 'Select purpose…', purpose)
    else await pickOption(page, 'Select department…', departmentName)
    await fillReason(page, reason)
    await addItem(page, sku)
    await page.getByRole('button', { name: 'Submit for approval' }).click()
    await page.waitForURL(/\/inventory\/delivery-receipts\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    await expect(page.getByText('Pending approval')).toBeVisible()
    return { id: page.url().split('/').pop()!, branch, itemName: name }
  }

  test('the Business Owner approves a DR they raised, drafting its debit memo', async ({
    page,
  }) => {
    test.skip(!departmentId, 'could not create a department fixture')
    await submitFromForm(page, 'Office use', 'owner raises and approves')
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click()
    await expect(page.getByText(/A debit memo is drafted for accounting/)).toBeVisible()
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(page.getByText('Awaiting accounting')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/^DMINV0926-\d{3,}$/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  })

  test('rejecting needs a reason and shows it on the DR', async ({ page }) => {
    await submitFromForm(page, 'Giveaways', 'to be rejected')
    await page.getByRole('button', { name: 'Reject', exact: true }).first().click()
    const confirm = page.getByRole('button', { name: 'Reject', exact: true }).last()
    await expect(confirm).toBeDisabled()
    await fillStable(page.getByLabel('Reason for rejecting'), 'Wrong item')
    await confirm.click()
    await expect(page.getByText('Rejected:')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Wrong item')).toBeVisible()
  })

  async function pickAccount(page: Page, index: number, number: string): Promise<void> {
    const input = page.getByLabel('Account', { exact: true }).nth(index)
    await input.click()
    await input.fill(number)
    await page
      .getByRole('button', { name: new RegExp(`^${number} — `) })
      .first()
      .click()
  }

  test('accounting posts the DR memo, then voids it', async ({ page }) => {
    test.skip(!departmentId, 'could not create a department fixture')
    const {
      id: drId,
      branch,
      itemName,
    } = await submitFromForm(page, 'Office use', 'memo post and void')
    // Posting checks on-hand quantity for real, so put the unit on the shelf.
    await ensureItemStock(page, { branchName: branch, itemQuery: itemName, quantity: 1 })
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click()
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    const memoLink = page.getByRole('link', { name: /^DMINV0926-\d{3,}$/ })
    await expect(memoLink).toBeVisible({ timeout: 15_000 })
    const memoNumber = (await memoLink.innerText()).trim()
    await memoLink.click()
    await expect(page.getByRole('heading', { name: 'Debit memo' })).toBeVisible()
    // The drafted lines carry the estimated cost — zero for this catalog item,
    // so the accountant types the amounts, as they would for real.
    await fillStable(page.getByLabel('Debit amount').first(), '1000')
    await fillStable(page.getByLabel('Credit amount').nth(1), '1000')
    await expect(page.getByText('Balanced')).toBeVisible()

    await page.getByRole('button', { name: 'Post', exact: true }).first().click()
    await page.getByRole('button', { name: 'Post', exact: true }).last().click()
    await expect(page.getByText('Posted', { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    await gotoReady(page, `/inventory/delivery-receipts/${drId}`)
    await expect(page.getByText('Posted', { exact: true }).first()).toBeVisible()

    await gotoReady(page, '/inventory/stock-transaction?tab=debit-memos')
    // Supplier returns and internal memos share one list.
    await expect(page.getByRole('link', { name: memoNumber })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: memoNumber }).first().click()
    await page.waitForURL(/\/accounting\/debit-memos\/inventory\/[0-9a-f-]{36}$/, {
      timeout: 20_000,
    })
    await expect(page.getByRole('heading', { name: 'Debit memo' })).toBeVisible()
    await page.getByRole('button', { name: /Void/ }).first().click()
    await fillStable(page.getByLabel('Reason', { exact: true }), 'E2E cleanup')
    await page.getByRole('button', { name: 'Void memo' }).click()
    await expect(page.getByText('Voided:')).toBeVisible({ timeout: 15_000 })
  })

  test('accounting raises a standalone memo from the hub', async ({ page }) => {
    await gotoReady(page, '/accounting/debit-memos')
    await page.getByRole('link', { name: 'New inventory memo' }).click()
    await expect(page.getByRole('heading', { name: 'New debit memo' })).toBeVisible()
    await pickAccount(page, 0, '6-02-010')
    await pickAccount(page, 1, '1-01-162')
    await fillStable(page.getByLabel('Debit amount').first(), '500')
    await fillStable(page.getByLabel('Credit amount').nth(1), '500')
    await expect(page.getByText('Balanced')).toBeVisible()
    await page.getByRole('button', { name: 'Save as draft' }).click()
    await page.waitForURL(/\/accounting\/debit-memos\/inventory\/[0-9a-f-]{36}$/, {
      timeout: 20_000,
    })
    await expect(page.getByText(/^DMINV0926-\d{3,}$/).first()).toBeVisible()
    // A standalone draft voids cleanly — nothing posted, no DR.
    await page.getByRole('button', { name: /Void/ }).first().click()
    await fillStable(page.getByLabel('Reason', { exact: true }), 'E2E cleanup')
    await page.getByRole('button', { name: 'Void memo' }).click()
    await expect(page.getByText('Voided:')).toBeVisible({ timeout: 15_000 })
  })

  test('prints the DR and its debit memo in the client layout', async ({ page, context }) => {
    test.skip(!departmentId, 'could not create a department fixture')
    const { id } = await submitFromForm(page, 'Office use', 'print check')
    const [drWin] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Print', exact: true }).click(),
    ])
    await drWin.waitForLoadState('domcontentloaded')
    await expect(drWin.getByRole('heading', { name: 'Delivery receipt' })).toBeVisible()
    await expect(drWin.getByText('DRAFT', { exact: true })).toBeVisible()
    await expect(drWin.getByText('☒ Office use')).toBeVisible()
    await expect(
      drWin.getByText('Received the above merchandise in good order and condition.')
    ).toBeVisible()
    await expect(drWin.getByText('Delivered by')).toBeVisible()
    await drWin.close()

    await gotoReady(page, `/inventory/delivery-receipts/${id}`)
    // Freshly loaded: retry the click until hydration has attached it.
    await clickStable(
      page.getByRole('button', { name: 'Approve', exact: true }).first(),
      page.getByText(/A debit memo is drafted for accounting/)
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    const memoLink = page.getByRole('link', { name: /^DMINV0926-\d{3,}$/ })
    await expect(memoLink).toBeVisible({ timeout: 15_000 })
    await memoLink.click()
    await expect(page.getByRole('heading', { name: 'Debit memo' })).toBeVisible()
    const [memoWin] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Print', exact: true }).click(),
    ])
    await memoWin.waitForLoadState('domcontentloaded')
    await expect(memoWin.getByRole('heading', { name: 'Debit memo' })).toBeVisible()
    await expect(memoWin.getByText('Total debit')).toBeVisible()
    await expect(memoWin.getByText('Noted by')).toBeVisible()
    await memoWin.close()
  })

  test('Proceed to POS arrives at checkout with the held unit and the DR banner', async ({
    page,
    request,
  }) => {
    type Row = Record<string, unknown> & { id: string }
    const json = async (url: string, params: Record<string, string> = {}) =>
      (await request.get(url, { params })).json()
    const terminals = await json('/api/pos/terminals', { limit: '200' })
    const terminal = ((terminals.data ?? terminals) as Row[]).find(
      (t) => t.terminalCode === 'TN-B1-01'
    )
    test.skip(!terminal, 'no TN-B1-01 terminal in this database')
    const warehouses = (await json('/api/inventory/warehouses', { limit: '200', status: 'active' }))
      .data as Row[]
    const warehouse = warehouses.find((w) => w.branchId === terminal!.branchId)!
    const serials = (
      await json('/api/inventory/serial-numbers', {
        warehouseId: warehouse.id,
        status: 'in_stock',
        limit: '5',
      })
    ).data as (Row & { serialNumber: string; item?: { id: string } | null; itemId?: string })[]
    // A held serial when the branch has one; otherwise a plain item, which
    // still proves the hand-off (customer, line, banner).
    const serial = serials[0]
    const plain = serial ? null : await firstPlainItem(page)
    const customers = (await json('/api/inventory/delivery-receipts/lookups/customers')) as Row[]

    const created = await request.post('/api/inventory/delivery-receipts', {
      data: {
        purpose: 'sales_invoice_to_follow',
        issueDate: new Date().toISOString().slice(0, 10),
        warehouseId: warehouse.id,
        customerId: customers[0].id,
        reason: `${E2E_TAG} proceed to POS`,
        lines: serial
          ? [{ itemId: serial.item?.id ?? serial.itemId, serialNumberId: serial.id }]
          : [{ itemId: plain!.id, quantity: 1 }],
      },
    })
    expect(created.ok()).toBe(true)
    const dr = await created.json()
    expect((await request.post(`/api/inventory/delivery-receipts/${dr.id}/submit`)).ok()).toBe(true)
    expect((await request.post(`/api/inventory/delivery-receipts/${dr.id}/approve`)).ok()).toBe(
      true
    )

    const open = (await json('/api/pos/sessions', { status: 'open', limit: '100' })) as {
      data?: Row[]
    }
    let sessionId = (open.data ?? []).find((s) => s.terminalId === terminal!.id)?.id
    let openedHere = false
    if (!sessionId) {
      const opened = await request.post('/api/pos/sessions/open', {
        data: { terminalId: terminal!.id, openingCash: 1000 },
      })
      expect(opened.ok()).toBe(true)
      sessionId = (await opened.json()).id
      openedHere = true
    }

    try {
      await gotoReady(page, `/inventory/delivery-receipts/${dr.id}`)
      await page.getByRole('button', { name: 'Proceed to POS' }).click()
      await page.waitForURL(/\/pos\/checkout/, { timeout: 30_000 })
      await expect(page.getByText(`Invoicing ${dr.drNumber}`, { exact: false })).toBeVisible({
        timeout: 45_000,
      })
      await expect(page.getByText(serial ? serial.serialNumber : plain!.name).first()).toBeVisible()
    } finally {
      if (openedHere && sessionId) {
        await request.post(`/api/pos/sessions/${sessionId}/close`, {
          data: { declaredClosingCash: 1000 },
        })
      }
    }
  })

  test('a UDS ready for the service center goes out on a DR from the UDS list', async ({
    page,
    request,
  }) => {
    type Row = Record<string, unknown> & { id: string }
    const json = async (url: string, params: Record<string, string> = {}) =>
      (await request.get(url, { params })).json()
    // A repair UDS raised at the main branch has no trip to make, so it opens
    // as received (Part 10) — ready to assess.
    const branches = (await json('/api/branches', { limit: '200' })).data as Row[]
    const main = branches.find((b) => b.isMainBranch)
    test.skip(!main, 'no main branch in this database')
    const warehouses = (await json('/api/inventory/warehouses', { limit: '200', status: 'active' }))
      .data as Row[]
    const warehouse = warehouses.find((w) => w.branchId === main!.id)!
    const serials = (
      await json('/api/inventory/serial-numbers', {
        warehouseId: warehouse.id,
        status: 'in_stock',
        limit: '1',
      })
    ).data as Row[]
    test.skip(!serials[0], 'no in-stock serial at the main branch')
    const suppliers = (await json('/api/suppliers', { limit: '1' })).data as (Row & {
      name: string
    })[]

    const created = await request.post('/api/inventory/uds', {
      data: {
        warehouseId: warehouse.id,
        reason: 'repair',
        repairProviderId: suppliers[0].id,
        notes: `${E2E_TAG} repair DR`,
        lines: [{ serialNumberId: serials[0].id }],
      },
    })
    expect(created.ok()).toBe(true)
    const uds = (await created.json()) as { id: string; code: string; status: string }
    const patch = (path: string, data: Record<string, unknown>) =>
      request.patch(`/api/inventory/uds/${uds.id}/${path}`, { data })
    expect(uds.status).toBe('received')
    expect((await patch('assess', { assessment: 'repairable', estimatedCost: 500 })).ok()).toBe(
      true
    )

    await gotoReady(page, '/inventory/uds')
    const row = page.locator('tbody tr').filter({ hasText: uds.code })
    const createDr = row.getByRole('button', { name: 'Create DR to Service Centre' })
    await expect(createDr).toBeVisible({ timeout: 20_000 })
    await createDr.click()
    await page.waitForURL(/\/inventory\/delivery-receipts\/new\?purpose=to_service_center/)
    // The ticket's unit and provider fill in; there is nothing to pick.
    await expect(page.getByText(String(serials[0].serialNumber))).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(suppliers[0].name).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add item' })).toHaveCount(0)
    await fillReason(page, 'unit to the service center')
    await page.getByRole('button', { name: 'Submit for approval' }).click()
    await page.waitForURL(/\/inventory\/delivery-receipts\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    await expect(page.getByText('Pending approval').first()).toBeVisible()
    await expect(page.getByText(uds.code)).toBeVisible()

    await page.getByRole('button', { name: 'Approve', exact: true }).first().click()
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(page.getByText('Posted').first()).toBeVisible({ timeout: 20_000 })
    // A repair DR has already moved its ticket, so it offers no Void.
    await expect(page.getByRole('button', { name: /Void/ })).toHaveCount(0)
    const after = await json(`/api/inventory/uds/${uds.id}`)
    expect(after.status).toBe('at_provider')
    expect(String(after.dispatchDeliveryReceiptNumber)).toMatch(/^DR\d{6}$/)
  })
})
