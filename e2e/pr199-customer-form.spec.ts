import { test, expect, type Page } from '@playwright/test'
import {
  deleteCustomers,
  fillAllStable,
  fillPhoneStable,
  gotoReady,
  sweepE2ECustomers,
} from './utils'

// PR #199 review (Chloe, 2026-10-02) — the customer form.
//
//   1. "Please let user type/search the number" — the birthday's Month/Day/
//      Year pickers only took a value on Enter or a click. Typed text was
//      thrown away on Tab or a click elsewhere.
//   3. "upon credit application, the birthdate doesnt show anything" — the
//      same bug: a birthday is only stored once all three parts are set, so a
//      half-committed one saved as no birthday, silently.
//   2. "Add checklist 'Home address is same as current address'".
//
// Runs against whatever stack the config points at; every customer it makes
// starts with NAME_PREFIX and is swept before and deleted after.

const NAME_PREFIX = 'E2E PR199'

const part = (page: Page, name: 'Month' | 'Day' | 'Year') =>
  page.getByPlaceholder(name, { exact: true })

const sameAsCurrent = (page: Page) =>
  page.getByRole('checkbox', { name: 'Home address is same as current address' })

const homeBlock = (page: Page) => page.getByRole('group', { name: 'Home address' })

// Fixtures made through the API use +63 phones: the phone field rewrites a
// local "09…" number into +63 form on the first re-render, which would make
// any edit form read as changed for a reason unrelated to what is tested.

async function openNewCustomer(page: Page, lastName: string) {
  await gotoReady(page, '/crm/customers/new')
  await expect(part(page, 'Month')).toBeVisible({ timeout: 15_000 })
  await fillAllStable([
    { locator: page.getByLabel('First name *'), value: 'E2E' },
    { locator: page.getByLabel('Last name *'), value: lastName },
  ])
  await fillPhoneStable(
    page.locator('.phone-input-field').first(),
    `9${Date.now().toString().slice(-9)}`
  )
}

/** Clicks Create and returns the new customer's id from the detail URL. */
async function createCustomer(page: Page): Promise<string> {
  await expect(async () => {
    await page.getByRole('button', { name: 'Create customer' }).click()
    await expect(page).toHaveURL(/\/crm\/customers\/[a-f0-9-]{36}$/, { timeout: 8_000 })
  }).toPass({ timeout: 30_000 })
  return page.url().split('/').pop()!
}

async function getCustomer(page: Page, id: string) {
  const res = await page.request.get(`/api/crm/customers/${id}`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return (body.data ?? body) as {
    birthday: string | null
    address: string | null
    homeAddress: string | null
    homeBarangayCode: string | null
  }
}

test.describe('PR #199 — customer form birthday and home address', () => {
  const createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, NAME_PREFIX)
  })

  test.afterAll(async ({ request }) => {
    await deleteCustomers(request, createdIds)
  })

  test('a birthday typed by keyboard is kept on Tab and on clicking away (points 1 and 3)', async ({
    page,
  }) => {
    await openNewCustomer(page, `PR199 Birthday ${Date.now()}`)

    // Month: type, then Tab — no Enter, no click on an option.
    await part(page, 'Month').click()
    await part(page, 'Month').pressSequentially('sep')
    await part(page, 'Month').press('Tab')
    await expect(part(page, 'Month')).toHaveValue('September')
    // Tab moves straight on to Day — nothing (like a per-box ×) in between.
    await expect(part(page, 'Day')).toBeFocused()

    await part(page, 'Day').pressSequentially('21')
    await part(page, 'Day').press('Tab')
    await expect(part(page, 'Day')).toHaveValue('21')
    await expect(part(page, 'Year')).toBeFocused()

    // Year: type, then click another field. This click is what wiped
    // Chloe's year and saved the customer with no birthday.
    await part(page, 'Year').pressSequentially('1990')
    await page.getByLabel('First name *').click()
    await expect(part(page, 'Year')).toHaveValue('1990')

    const id = await createCustomer(page)
    createdIds.push(id)
    expect((await getCustomer(page, id)).birthday?.slice(0, 10)).toBe('1990-09-21')
  })

  test('typing filters from the start, and a leading zero is ignored', async ({ page }) => {
    await openNewCustomer(page, `PR199 Filter ${Date.now()}`)
    const options = page.getByTestId('searchable-select-option')

    // Day "2" offers 2 and 20–29 — not 12 or 22's neighbours from "anywhere"
    // matching, which listed 12 before 20.
    await part(page, 'Day').click()
    await part(page, 'Day').pressSequentially('2')
    const dayLabels = (await options.allInnerTexts()).map((t) => t.trim())
    expect(dayLabels).toContain('2')
    expect(dayLabels).toContain('20')
    expect(dayLabels).not.toContain('12')
    expect(dayLabels.every((d) => d.startsWith('2'))).toBeTruthy()

    // "09" commits 9 on Tab.
    await part(page, 'Day').fill('09')
    await part(page, 'Day').press('Tab')
    await expect(part(page, 'Day')).toHaveValue('9')

    // Year "19" lists the 1900s — 2019 used to come first, and Enter took it.
    await part(page, 'Year').click()
    await part(page, 'Year').pressSequentially('19')
    const yearLabels = (await options.allInnerTexts()).map((t) => t.trim())
    expect(yearLabels.length).toBeGreaterThan(0)
    expect(yearLabels.every((y) => y.startsWith('19'))).toBeTruthy()
    expect(yearLabels).not.toContain('2019')

    // An ambiguous fragment ("ju" — June or July) is not guessed on Tab.
    await part(page, 'Month').click()
    await part(page, 'Month').pressSequentially('ju')
    await part(page, 'Month').press('Tab')
    await expect(part(page, 'Month')).toHaveValue('')
  })

  test('half a birthday blocks saving until it is finished or cleared', async ({ page }) => {
    const lastName = `PR199 Partial ${Date.now()}`
    await openNewCustomer(page, lastName)

    await part(page, 'Month').click()
    await part(page, 'Month').pressSequentially('sep')
    await part(page, 'Month').press('Tab')
    await part(page, 'Day').pressSequentially('21')
    await part(page, 'Day').press('Tab')

    await expect(page.getByText(/Pick the month, day and year/)).toBeVisible()
    await page.getByRole('button', { name: 'Create customer' }).click()
    await expect(page.getByText(/The birthday is incomplete/)).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/crm\/customers\/new$/)

    // Clearing it is a valid answer: the customer saves with no birthday.
    await page.getByRole('button', { name: 'clear the birthday' }).click()
    await expect(part(page, 'Month')).toHaveValue('')
    await expect(part(page, 'Day')).toHaveValue('')
    await expect(page.getByText(/Pick the month, day and year/)).toHaveCount(0)

    const id = await createCustomer(page)
    createdIds.push(id)
    expect((await getCustomer(page, id)).birthday).toBeNull()
  })

  test('a new customer starts with "Home address is same as current address" ticked (point 2)', async ({
    page,
  }) => {
    await openNewCustomer(page, `PR199 Home ${Date.now()}`)

    await expect(sameAsCurrent(page)).toBeChecked()
    await expect(homeBlock(page)).toHaveCount(0)

    await sameAsCurrent(page).uncheck()
    await expect(homeBlock(page)).toBeVisible()
    await sameAsCurrent(page).check()
    await expect(homeBlock(page)).toHaveCount(0)

    const id = await createCustomer(page)
    createdIds.push(id)
    // "Same as current" is stored as an empty home address — what every
    // reader (the credit application, the detail views) treats it as.
    expect((await getCustomer(page, id)).homeAddress || '').toBe('')
  })

  test('a separate home address opens unticked, and ticking the box clears it', async ({
    page,
  }) => {
    const name = `${NAME_PREFIX} HomeEdit ${Date.now()}`
    const res = await page.request.post('/api/crm/customers', {
      data: {
        name,
        firstName: 'E2E',
        lastName: name.replace('E2E ', ''),
        customerType: 'individual',
        phone: `+63917${Date.now().toString().slice(-7)}`,
        address: '1 Current St, Bago',
        homeAddress: '9 Home St, Iloilo City',
      },
    })
    expect(res.ok()).toBeTruthy()
    const created = await res.json()
    const id = (created.data ?? created).id as string
    createdIds.push(id)

    await gotoReady(page, `/crm/customers/${id}/edit`)
    await expect(sameAsCurrent(page)).not.toBeChecked({ timeout: 15_000 })
    await expect(homeBlock(page)).toBeVisible()

    await sameAsCurrent(page).check()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Before the fix the form sent nothing for an empty home address, so an
    // update could never clear one that was already saved.
    await expect(async () => {
      expect((await getCustomer(page, id)).homeAddress || '').toBe('')
    }).toPass({ timeout: 15_000 })

    await gotoReady(page, `/crm/customers/${id}/edit`)
    await expect(sameAsCurrent(page)).toBeChecked({ timeout: 15_000 })
  })

  test('a home address identical to the current one opens ticked', async ({ page }) => {
    const name = `${NAME_PREFIX} HomeSame ${Date.now()}`
    const res = await page.request.post('/api/crm/customers', {
      data: {
        name,
        firstName: 'E2E',
        lastName: name.replace('E2E ', ''),
        customerType: 'individual',
        phone: `+63918${Date.now().toString().slice(-7)}`,
        address: '5 Same St, Bago',
        homeAddress: '5 Same St, Bago',
      },
    })
    expect(res.ok()).toBeTruthy()
    const created = await res.json()
    const id = (created.data ?? created).id as string
    createdIds.push(id)

    await gotoReady(page, `/crm/customers/${id}/edit`)
    await expect(sameAsCurrent(page)).toBeChecked({ timeout: 15_000 })
    await expect(homeBlock(page)).toHaveCount(0)
  })

  // The checkbox's own state is set on the form's starting values too, so
  // opening a customer is not an unsaved change. Checked on a customer with
  // no address: the address picker re-composes any address it loads into its
  // own "street, barangay, city, …, Philippines" format, so an address written
  // straight through the API reads as edited the moment the form opens — the
  // picker's behaviour, not this checkbox's.
  test('opening a customer with no separate home address is not a change', async ({ page }) => {
    const name = `${NAME_PREFIX} HomeNone ${Date.now()}`
    const res = await page.request.post('/api/crm/customers', {
      data: {
        name,
        firstName: 'E2E',
        lastName: name.replace('E2E ', ''),
        customerType: 'individual',
        phone: `+63919${Date.now().toString().slice(-7)}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const created = await res.json()
    const id = (created.data ?? created).id as string
    createdIds.push(id)

    await gotoReady(page, `/crm/customers/${id}/edit`)
    await expect(sameAsCurrent(page)).toBeChecked({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    // Unticking is a change; ticking back is not.
    await sameAsCurrent(page).uncheck()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await sameAsCurrent(page).check()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })
})
