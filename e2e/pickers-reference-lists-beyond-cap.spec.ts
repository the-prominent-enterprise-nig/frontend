import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, pickFromSearchCombobox } from './utils'

// Docket #94 audit, Group 3 — supplier filters, the Attributes category list,
// and the Assign Manager user list. Each loaded ONE page (200) of a table
// that is longer — 4,000+ suppliers, 380+ categories, 400 users — and offered
// only that (the manager search even filtered those 200 in the browser).
//
// Every test reaches a record the old page could not:
//   - suppliers: a name that sorts after 200 others, found by typing;
//   - categories: one of those beyond the first 200 active;
//   - users: one beyond the first 200 active, found by typing their email.

const STAMP = Date.now()
const TARGET_SUPPLIER = `ZZZ E2E Supplier ${STAMP}`
const createdSupplierIds: string[] = []

async function createSupplier(page: Page, code: string, name: string): Promise<void> {
  const res = await page.request.post('/api/suppliers', { data: { code, name } })
  expect(res.ok(), await res.text()).toBeTruthy()
  createdSupplierIds.push(((await res.json()) as { id: string }).id)
}

test.describe.configure({ mode: 'serial' })

test.describe('Reference lists — reach records beyond the old 200', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    const context = await browser.newContext({ storageState: 'e2e/.auth/business-owner.json' })
    const page = await context.newPage()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

    // 205 suppliers that sort before the target, so it is past the old page.
    const existing = (await (await page.request.get('/api/suppliers?limit=1')).json()) as {
      meta?: { total: number }
      total?: number
    }
    const have = existing.meta?.total ?? existing.total ?? 0
    const needed = Math.max(0, 205 - have)
    for (let i = 0; i < needed; i += 20) {
      await Promise.all(
        Array.from({ length: Math.min(20, needed - i) }, (_, k) => {
          const n = String(i + k).padStart(3, '0')
          return createSupplier(
            page,
            `E2E-S-${STAMP % 1_000_000}-${n}`,
            `AAA E2E Supplier ${STAMP} ${n}`
          )
        })
      )
    }
    await createSupplier(page, `E2E-S-${STAMP % 1_000_000}-ZZ`, TARGET_SUPPLIER)
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/business-owner.json' })
    const page = await context.newPage()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    for (const id of createdSupplierIds) {
      await page.request.delete(`/api/suppliers/${id}`).catch(() => undefined)
    }
    await context.close()
  })

  test('Purchase Orders: the supplier filter finds a supplier outside the first 200', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/purchase-orders')
    await pickFromSearchCombobox(
      page,
      'All suppliers',
      TARGET_SUPPLIER,
      TARGET_SUPPLIER,
      TARGET_SUPPLIER
    )
  })

  test('Receiving Reports: the supplier filter finds a supplier outside the first 200', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=receiving')
    await pickFromSearchCombobox(
      page,
      'All Suppliers',
      TARGET_SUPPLIER,
      TARGET_SUPPLIER,
      TARGET_SUPPLIER
    )
  })

  test('Attributes: the category list offers every active category, not just the first 200', async ({
    page,
  }) => {
    const rows = (
      (await (
        await page.request.get('/api/inventory/categories', {
          params: { limit: '500', status: 'active' },
        })
      ).json()) as { data: { name: string }[] }
    ).data
    expect(rows.length, 'more active categories than the old 200').toBeGreaterThan(200)
    const firstPage = new Set(rows.slice(0, 200).map((c) => c.name))
    const beyond = rows.slice(200).find((c) => !firstPage.has(c.name))
    expect(beyond, 'a category name that only appears past the first 200').toBeTruthy()

    await gotoReady(page, '/inventory/attributes')
    await clickStable(
      page.getByRole('button', { name: '+ New Attribute' }).first(),
      page.locator('select').filter({ hasText: 'Select category…' }).first()
    )
    const select = page.locator('select').filter({ hasText: 'Select category…' }).first()
    await expect(select.locator('option', { hasText: beyond!.name }).first()).toBeAttached({
      timeout: 20_000,
    })
    await expect(select.locator('option')).toHaveCount(rows.length + 1, { timeout: 20_000 })
  })

  test('Assign Manager: a user outside the first 200 can be found by email', async ({ page }) => {
    const beyond = (
      (await (
        await page.request.get('/api/users', {
          params: { status: 'ACTIVE', page: '2', limit: '200' },
        })
      ).json()) as { data: { email: string }[] }
    ).data[0]
    expect(beyond, 'an active user past the first 200').toBeTruthy()
    const branches = (
      (await (await page.request.get('/api/branches?limit=200')).json()) as {
        data: { id: string }[]
      }
    ).data

    await gotoReady(page, `/settings/branches/${branches[0].id}`)
    await clickStable(
      page.getByRole('button', { name: 'Add Manager' }),
      page.getByPlaceholder('Search by name or email…')
    )
    await page.getByPlaceholder('Search by name or email…').fill(beyond.email)
    await expect(page.getByText(beyond.email, { exact: true })).toBeVisible({ timeout: 20_000 })
  })
})
