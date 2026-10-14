import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable, pickComboboxOption, ensureItemStock } from './utils'

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

async function firstPlainItem(page: Page): Promise<{ sku: string; name: string }> {
  const res = await page.request.get('/api/inventory/items', {
    params: { limit: '100', lifecycle: 'active' },
  })
  const items = ((await res.json()).data ?? []) as {
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
    await expect(page.getByRole('button', { name: 'Delete draft' })).toBeVisible()
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
})
