/**
 * Client item #11 — the Chart of Accounts "New Account" page, as the client's
 * mockup draws it: Account No. and Name; Account Type and Group / Category;
 * Cash Flow Classification; Description; Cancel and Save. Parent Account
 * is the one addition (kept at the user's say-so).
 *
 * Group / Category is one select holding the client's four balance-sheet groups,
 * so only an asset or a liability uses it. The category the reports read is set
 * from it, and an existing account keeps the finer one it has. Cash Flow
 * Classification is optional; blank means the account follows its category.
 *
 * Creates accounts under a unique E2E- number and soft-deletes them afterwards.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

const tag = `E2E-COA-${Date.now()}`
const created: string[] = []

async function pick(page: Page, name: string, option: string) {
  // A click can land before the page has hydrated (a cold dev compile), so keep
  // opening the list until the option is actually on screen.
  await expect(async () => {
    await page.getByRole('combobox', { name, exact: true }).click()
    await page.getByRole('option', { name: option, exact: true }).click({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
}

async function fillFields(page: Page, number: string, name: string) {
  await expect(async () => {
    await page.getByPlaceholder('e.g. 1-01-010').fill(number)
    await page.getByPlaceholder('Enter account name').fill(name)
    await expect(page.getByPlaceholder('e.g. 1-01-010')).toHaveValue(number)
    await expect(page.getByPlaceholder('Enter account name')).toHaveValue(name)
  }).toPass({ timeout: 10_000 })
}

async function accountByNumber(page: Page, number: string) {
  const res = await page.request.get(`/api/accounts?search=${encodeURIComponent(number)}&limit=5`)
  expect(res.ok()).toBe(true)
  const list = (await res.json()) as Array<Record<string, any>>
  return list.find((a) => a.number === number)
}

const save = (page: Page) => page.getByRole('button', { name: 'Save' })
const formAlert = (page: Page) => page.locator('form [role="alert"]')

test.afterAll(async ({ request }) => {
  for (const id of created) await request.delete(`/api/accounts/${id}`).catch(() => {})
})

test.describe('Chart of Accounts — New Account page', () => {
  test('is a page laid out like the client’s mockup', async ({ page }) => {
    await gotoReady(page, '/accounting/chart-of-accounts/new')
    await expect(page.getByRole('heading', { name: 'New Account' })).toBeVisible()
    await expect(page.getByRole('dialog').filter({ hasText: 'New Account' })).toHaveCount(0)
    for (const label of [
      'Account No. *',
      'Account Name *',
      'Account Type *',
      'Group / Category *',
      'Cash Flow Classification',
      'Description',
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }

    // The mockup's order: No. | Name, then Type | Group / Category, then Cash Flow
    // on its own row, then Description, then Cancel / Save.
    const y = async (label: string) => (await page.getByText(label, { exact: true }).boundingBox())!
    const [no, name, type, group, cash, desc] = await Promise.all(
      [
        'Account No. *',
        'Account Name *',
        'Account Type *',
        'Group / Category *',
        'Cash Flow Classification',
        'Description',
      ].map(y)
    )
    expect(Math.abs(no.y - name.y)).toBeLessThan(6)
    expect(no.x).toBeLessThan(name.x)
    expect(Math.abs(type.y - group.y)).toBeLessThan(6)
    expect(type.x).toBeLessThan(group.x)
    expect(type.y).toBeGreaterThan(no.y)
    expect(cash.y).toBeGreaterThan(type.y)
    expect(desc.y).toBeGreaterThan(cash.y)
    const cancel = (await page.getByRole('link', { name: 'Cancel' }).boundingBox())!
    expect(cancel.y).toBeGreaterThan(desc.y)

    // The mockup's placeholders.
    await expect(page.getByRole('combobox', { name: 'Select account type' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Select group or category' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Select classification' })).toBeVisible()
    await expect(page.getByPlaceholder('Enter description (optional)')).toBeVisible()
    // The client asked for no Status field; Parent Account stays.
    await expect(page.getByText('Status', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Parent Account', { exact: true })).toBeVisible()
  })

  test('offers the client’s lists, word for word', async ({ page }) => {
    await gotoReady(page, '/accounting/chart-of-accounts/new')
    const options = async (name: string) => {
      await expect(async () => {
        await page.getByRole('combobox', { name, exact: true }).click()
        await expect(page.getByRole('option').first()).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 20_000 })
      const texts = await page.getByRole('option').allInnerTexts()
      await page.keyboard.press('Escape')
      return texts
    }
    expect(await options('Select account type')).toEqual([
      'Asset',
      'Liability',
      'Equity',
      'Revenue',
      'Cost of Sales',
      'Operating Expenses',
      'Other Operating Income',
      'Non-Operating Expenses',
    ])
    expect(await options('Select classification')).toEqual([
      'Operating Activities',
      'Investing Activities',
      'Financing Activities',
    ])
    await pick(page, 'Select account type', 'Asset')
    expect(await options('Select group or category')).toEqual([
      'Current Asset',
      'Non-current Asset',
    ])
    await pick(page, 'Asset', 'Liability')
    expect(await options('Select group or category')).toEqual([
      'Current Liability',
      'Non-Current Liability',
    ])
  })

  test('Group / Category is one select — nothing finer follows it — and does not apply to the other types', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/chart-of-accounts/new')
    await pick(page, 'Select account type', 'Liability')
    await pick(page, 'Select group or category', 'Non-Current Liability')
    await expect(page.getByRole('combobox', { name: 'Non-Current Liability' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /category/i })).toHaveCount(0)

    await pick(page, 'Liability', 'Cost of Sales')
    // The field is the client's four balance-sheet groups; a cost of sales has none.
    const group = page.getByRole('combobox', { name: 'Not applicable' })
    await expect(group).toBeDisabled()
    await expect(page.getByText('Group / Category', { exact: true })).toBeVisible()
  })

  test('asks for what is missing, in order', async ({ page }) => {
    await gotoReady(page, '/accounting/chart-of-accounts/new')
    const alert = formAlert(page)
    // The first click can land before the page has hydrated and do nothing; the
    // alert appearing is what shows it has.
    await expect(async () => {
      await save(page).click()
      await expect(alert).toContainText('Enter the account number.', { timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    await fillFields(page, `${tag}-V`, 'validation')
    await save(page).click()
    await expect(alert).toContainText('Select the account type.')
    await pick(page, 'Select account type', 'Asset')
    await save(page).click()
    await expect(alert).toContainText('Select the group')
    // A type with no groups is not asked for one.
    await pick(page, 'Asset', 'Revenue')
    await save(page).click()
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 30_000 })
    created.push(...(await createdIds(page, `${tag}-V`)))
  })

  test('saving a Non-current Asset files it under that group, with no cash flow section until one is set', async ({
    page,
  }) => {
    const number = `${tag}-NCA`
    await gotoReady(page, '/accounting/chart-of-accounts/new')
    // Picks first: a dropdown only opens once the page has hydrated, and fields
    // filled before that are wiped by hydration.
    await pick(page, 'Select account type', 'Asset')
    await pick(page, 'Select group or category', 'Non-current Asset')
    await fillFields(page, number, 'E2E non-current asset')
    await save(page).click()
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 30_000 })

    const a = await accountByNumber(page, number)
    expect(a).toBeTruthy()
    created.push(a!.id)
    expect(a).toMatchObject({
      type: 'ASSET',
      accountClass: 'ASSET',
      // The group's own category — and a capital-purchase one, so a capex line can
      // still post to an account made here.
      category: 'OTHER_NON_CURRENT_ASSETS',
      cashFlowClass: null,
    })
  })

  test('a type with no groups gets its ordinary category without being asked', async ({ page }) => {
    const number = `${tag}-COS`
    await gotoReady(page, '/accounting/chart-of-accounts/new')
    await pick(page, 'Select account type', 'Cost of Sales')
    await fillFields(page, number, 'E2E cost of sales')
    await save(page).click()
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 30_000 })
    const a = await accountByNumber(page, number)
    created.push(a!.id)
    expect(a).toMatchObject({ type: 'EXPENSE', accountClass: 'COST_OF_SALES', category: 'COGS' })
  })

  test('a Cash Flow section picked on the form is saved', async ({ page }) => {
    const number = `${tag}-ALL`
    await gotoReady(page, '/accounting/chart-of-accounts/new')
    await pick(page, 'Select account type', 'Asset')
    await pick(page, 'Select group or category', 'Non-current Asset')
    await pick(page, 'Select classification', 'Investing Activities')
    await fillFields(page, number, 'E2E investing')
    await save(page).click()
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 30_000 })
    const a = await accountByNumber(page, number)
    created.push(a!.id)
    expect(a!.cashFlowClass).toBe('INVESTING')
  })

  test('a parent from the same section is offered and saved', async ({ page }) => {
    const number = `${tag}-PAR`
    await gotoReady(page, '/accounting/chart-of-accounts/new')
    await pick(page, 'Select account type', 'Cost of Sales')
    await fillFields(page, number, 'E2E child of cost of product sales')
    await expect(async () => {
      await page.getByText('None — top level').click()
      await page.locator('input[type="text"]').last().fill('5-01-000')
      await expect(page.getByText('5-01-000 Cost of Product Sales')).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    // Only Cost of Sales accounts are offered — an asset numbered 1-… is not.
    await expect(page.getByText(/^1-\d\d-\d+ /)).toHaveCount(0)
    await page.getByText('5-01-000 Cost of Product Sales').click()
    await save(page).click()
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 30_000 })
    const a = await accountByNumber(page, number)
    created.push(a!.id)
    const parent = await accountByNumber(page, '5-01-000')
    expect(a!.parentAccountId).toBe(parent!.id)
  })

  test('Cash Flow Classification can be cleared back to blank', async ({ page }) => {
    const number = `${tag}-CLR`
    const res = await page.request.post('/api/accounts', {
      data: {
        number,
        name: 'E2E clear',
        accountClass: 'ASSET',
        category: 'CASH',
        cashFlowClass: 'INVESTING',
      },
    })
    expect(res.ok()).toBe(true)
    const made = await res.json()
    created.push(made.id)

    await gotoReady(page, `/accounting/chart-of-accounts/${made.id}/edit`)
    await expect(page.getByRole('combobox', { name: 'Investing Activities' })).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByRole('combobox', { name: 'Select classification' })).toBeVisible()
    await save(page).click()
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 30_000 })
    expect((await accountByNumber(page, number))!.cashFlowClass).toBeNull()
  })

  test('editing keeps the finer category an account already has while its group is unchanged', async ({
    page,
  }) => {
    const number = `${tag}-EDIT`
    const res = await page.request.post('/api/accounts', {
      data: { number, name: 'E2E cash-like', accountClass: 'ASSET', category: 'CASH' },
    })
    expect(res.ok()).toBe(true)
    const made = await res.json()
    created.push(made.id)

    await gotoReady(page, `/accounting/chart-of-accounts/${made.id}/edit`)
    await expect(page.getByPlaceholder('Enter account name')).toHaveValue('E2E cash-like', {
      timeout: 20_000,
    })
    // Cash is a current asset — the form shows the group, not the category.
    await expect(page.getByRole('combobox', { name: 'Current Asset' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /category/i })).toHaveCount(0)
    await expect(async () => {
      await page.getByPlaceholder('Enter account name').fill('E2E cash-like renamed')
      await expect(page.getByPlaceholder('Enter account name')).toHaveValue('E2E cash-like renamed')
    }).toPass({ timeout: 10_000 })
    await save(page).click()
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 30_000 })
    expect((await accountByNumber(page, number))!.category).toBe('CASH')

    // Moving it to the other group gives it that group's own category.
    await gotoReady(page, `/accounting/chart-of-accounts/${made.id}/edit`)
    await expect(page.getByPlaceholder('Enter account name')).toHaveValue('E2E cash-like renamed', {
      timeout: 20_000,
    })
    await pick(page, 'Current Asset', 'Non-current Asset')
    await save(page).click()
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 30_000 })
    expect((await accountByNumber(page, number))!.category).toBe('OTHER_NON_CURRENT_ASSETS')
  })
})

/** Ids of the accounts a test left under a number, so they can be tidied up. */
async function createdIds(page: Page, number: string): Promise<string[]> {
  const a = await accountByNumber(page, number)
  return a ? [a.id] : []
}
