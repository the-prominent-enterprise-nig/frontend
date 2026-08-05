import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  clickStable,
  deleteCustomers,
  fillAllStable,
  fillPhoneStable,
  fillStable,
  gotoReady,
  sweepE2ECustomers,
} from './utils'

const CUSTOMER_NAME_PREFIX = 'E2E IaFixture'

/** Same hydration-race retry fillStable uses, adapted for <select> (fill() doesn't work on selects). */
async function selectStable(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.selectOption(value)
    await expect(locator).toHaveValue(value)
  }).toPass({ timeout: 10_000 })
}

/**
 * A hydration reconciliation can silently wipe already-filled fields between
 * an earlier fill and a later submit click — same race fillAllStable's own
 * docstring describes, and the reason utils.ts's loginAs re-fills on every
 * retry rather than filling once up front. This is the most on-demand-
 * compiled route a given test visits (first cold Turbopack compile of the
 * page), so the risk is highest right here. Retrying the WHOLE fill+submit
 * sequence together, not just the click, is the only way to close it.
 */
async function submitStable(
  fill: () => Promise<void>,
  submit: () => Promise<void>,
  verify: () => Promise<void>,
  opts: { timeout?: number } = {}
): Promise<void> {
  await expect(async () => {
    await fill()
    await submit()
    await verify()
  }).toPass({ timeout: opts.timeout ?? 30_000 })
}

async function createCustomerViaUi(
  page: Page,
  suffix: number
): Promise<{ fullName: string; customerId: string }> {
  const firstName = 'E2E'
  const lastName = `IaFixture${suffix}`
  const fullName = `${firstName} ${lastName}`

  await gotoReady(page, '/crm/customers/new')
  await submitStable(
    async () => {
      await fillAllStable([
        { locator: page.getByLabel('First name *'), value: firstName },
        { locator: page.getByLabel('Last name *'), value: lastName },
        { locator: page.getByLabel('Email'), value: `e2e.ia.${suffix}@example.com` },
      ])
      await fillPhoneStable(page.locator('.phone-input-field'), `9${suffix.toString().slice(-9)}`)
    },
    () => page.getByRole('button', { name: 'Create customer' }).click(),
    () => expect(page).toHaveURL(/\/crm\/customers\/[a-f0-9-]+$/, { timeout: 8_000 })
  )

  const customerId = page.url().match(/\/crm\/customers\/([a-f0-9-]+)$/)?.[1]
  if (!customerId) throw new Error('createCustomerViaUi: customerId not found in URL after create')
  return { fullName, customerId }
}

/**
 * CustomerPicker only opens its results dropdown via an onFocus handler, a
 * separate mechanism from the input's controlled value — fillStable's
 * value-match retry doesn't prove that handler was attached yet when focus
 * landed. Retrying an explicit click (to (re)trigger focus) together with
 * the fill and the results-visible check closes that gap the same way
 * submitStable does for full-form submissions.
 */
async function pickCustomer(page: Page, searchTerm: string, fullName: string): Promise<void> {
  // Idempotent: once a customer is picked, CustomerPicker swaps to a "chip"
  // display with no search input — submitStable's outer retry may call this
  // again after a customer is already selected, so skip re-picking then.
  const alreadyPicked = await page
    .getByRole('button', { name: 'Change customer' })
    .isVisible()
    .catch(() => false)
  if (alreadyPicked) return

  const picker = page.getByPlaceholder('Search customer by name, email, or phone…')
  const resultButton = page.getByRole('button', { name: new RegExp(fullName) })
  await expect(async () => {
    await picker.click()
    await picker.fill(searchTerm)
    await expect(resultButton).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await resultButton.click()
}

test.describe('CRM — Collectors', () => {
  test('creates a collector, edits it, records a remittance, then deletes it (cleanup)', async ({
    page,
  }) => {
    const suffix = Date.now()
    const shortSuffix = String(suffix).slice(-8) // stubNumber is @db.VarChar(20)
    const stubNumber = `E2E-${shortSuffix}`
    const name = `E2E Collector ${suffix}`

    await gotoReady(page, '/crm/collectors/new')
    await submitStable(
      () =>
        fillAllStable([
          { locator: page.getByLabel('Stub number *'), value: stubNumber },
          { locator: page.getByLabel('Name *'), value: name },
        ]),
      () => page.getByRole('button', { name: 'Create collector' }).click(),
      () => expect(page).toHaveURL(/\/crm\/collectors\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    await expect(page.getByRole('heading', { name })).toBeVisible()

    const collectorId = page.url().match(/\/crm\/collectors\/([a-f0-9-]+)$/)?.[1]
    expect(collectorId).toBeTruthy()

    // Edit — rename it. EditCollectorForm loads the existing record
    // asynchronously (collectorsApi.get in a useEffect) and calls setForm()
    // once it resolves — filling before that lands gets silently overwritten
    // back to the original name. Waiting for the field to show its
    // pre-populated original value first proves that load already happened,
    // so the subsequent fill can't race it.
    const renamed = `${name} (Edited)`
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(`/crm/collectors/${collectorId}/edit`)
    await expect(page.getByLabel('Name *')).toHaveValue(name, { timeout: 10_000 })
    await submitStable(
      () => fillStable(page.getByLabel('Name *'), renamed),
      () => page.getByRole('button', { name: 'Save changes' }).click(),
      () => expect(page).toHaveURL(`/crm/collectors/${collectorId}`, { timeout: 8_000 })
    )
    await expect(page.getByRole('heading', { name: renamed })).toBeVisible({ timeout: 10_000 })

    // Record a remittance and confirm it shows up in the history + summary total
    await clickStable(
      page.getByRole('button', { name: 'Record remittance' }),
      page.getByRole('heading', { name: 'Record remittance' })
    )
    // Two "Record remittance" buttons exist at once: the header trigger and
    // the modal's own submit — scope to the form to hit the submit one.
    await submitStable(
      () =>
        fillAllStable([
          { locator: page.getByLabel('Amount (₱) *'), value: '2500' },
          { locator: page.getByLabel('Reference'), value: `E2E-REF-${suffix}` },
        ]),
      () => page.locator('form').getByRole('button', { name: 'Record remittance' }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Record remittance' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )

    await expect(page.getByText(`E2E-REF-${suffix}`)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('₱2,500.00').first()).toBeVisible()

    // Cleanup — CollectorService.remove() now cascades the CollectorRemittance
    // rows for this collector first (they're ON DELETE RESTRICT), so this
    // succeeds even though a remittance was just recorded.
    const del = await page.request.delete(`/api/crm/collectors/${collectorId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('lists collectors and filters them by search', async ({ page }) => {
    const suffix = Date.now()
    const shortSuffix = String(suffix).slice(-8)
    const stubNumber = `E2E-${shortSuffix}`
    const name = `E2E Searchable Collector ${suffix}`

    await gotoReady(page, '/crm/collectors/new')
    await submitStable(
      () =>
        fillAllStable([
          { locator: page.getByLabel('Stub number *'), value: stubNumber },
          { locator: page.getByLabel('Name *'), value: name },
        ]),
      () => page.getByRole('button', { name: 'Create collector' }).click(),
      () => expect(page).toHaveURL(/\/crm\/collectors\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const collectorId = page.url().match(/\/crm\/collectors\/([a-f0-9-]+)$/)?.[1]

    await gotoReady(page, '/crm/collectors')
    await expect(page.getByRole('heading', { name: 'Collectors' })).toBeVisible()
    await fillStable(page.getByPlaceholder(/search stub number or name/i), stubNumber)
    // Both the mobile card list and desktop table render simultaneously
    // (Tailwind responsive classes only toggle CSS display) — scope to the
    // desktop table to avoid a strict-mode multi-match.
    await expect(page.locator('table').getByText(name)).toBeVisible({ timeout: 10_000 })

    const del = await page.request.delete(`/api/crm/collectors/${collectorId}`)
    expect(del.ok()).toBeTruthy()
  })
})

test.describe('CRM — Installment Accounts', () => {
  let createdCustomerIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, CUSTOMER_NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await deleteCustomers(request, createdCustomerIds)
    createdCustomerIds = []
  })

  test('price checker modal computes financing terms without creating an account', async ({
    page,
  }) => {
    await gotoReady(page, '/crm/installment-accounts')
    await expect(page.getByRole('heading', { name: 'Installment Accounts' })).toBeVisible()

    const before = await page.request.get(
      '/api/crm/installment-accounts?limit=1&search=__price_check_probe__'
    )
    expect(before.ok()).toBeTruthy()

    await clickStable(
      page.getByRole('button', { name: 'Price checker' }),
      page.getByRole('heading', { name: 'Installment price checker' })
    )

    await fillAllStable([
      { locator: page.getByLabel('Listed cash price (₱)'), value: '50000' },
      { locator: page.getByLabel('Down payment (₱)'), value: '10000' },
      { locator: page.getByLabel('Term (months, 1-12)'), value: '12' },
      { locator: page.getByLabel('MI factor'), value: '0.0954' },
    ])

    // AF = 40000, MI = round2(40000*0.0954) = 3816, PNV = 3816*12 = 45792,
    // Total price = 45792+10000 = 55792, ID = 55792-50000 = 5792
    await expect(page.getByText('₱40,000.00')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('₱3,816.00')).toBeVisible()
    await expect(page.getByText('₱45,792.00')).toBeVisible()
    await expect(page.getByText('₱55,792.00')).toBeVisible()
    await expect(page.getByText('₱5,792.00')).toBeVisible()

    // Two "Close" buttons exist: the icon (aria-label="Close") and the
    // bottom text button — the text one is rendered last.
    await page.getByRole('button', { name: 'Close' }).last().click()
    await expect(page.getByRole('heading', { name: 'Installment price checker' })).toHaveCount(0)
  })

  test('creates an account with a correct financing preview and records an on-time payment', async ({
    page,
  }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '6' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '20000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '2000' },
          { locator: page.getByLabel('MI factor *'), value: '0.1' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    await expect(page.getByRole('heading', { name: accountNumber })).toBeVisible()

    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]
    expect(accountId).toBeTruthy()

    // AF = 18000, MI = 1800, PNV = 10800 — persisted values match the preview
    await expect(page.getByText('₱18,000.00')).toBeVisible()
    await expect(page.getByText('₱1,800.00').first()).toBeVisible()
    await expect(page.getByText('₱10,800.00').first()).toBeVisible()

    // Record an on-time payment (paidAt before dueDate) and confirm scoring feedback
    await clickStable(
      page.getByRole('button', { name: 'Record payment' }),
      page.getByRole('heading', { name: 'Record payment' })
    )
    // Two "Record payment" buttons exist: the header trigger and the modal's
    // own submit — scope to the form to hit the submit one.
    await submitStable(
      () =>
        fillAllStable([
          { locator: page.getByLabel('Amount (₱) *'), value: '1800' },
          { locator: page.getByLabel('Due date *'), value: '2026-08-15' },
          { locator: page.getByLabel('Paid at *'), value: '2026-08-10' },
        ]),
      () => page.locator('form').getByRole('button', { name: 'Record payment' }).click(),
      () => expect(page.getByText(/on time, \+1 point earned/i)).toBeVisible({ timeout: 8_000 })
    )
    await page.getByRole('button', { name: 'Done' }).click()

    // Balance decremented by the payment amount: 10800 - 1800 = 9000
    await expect(page.getByText('₱9,000.00')).toBeVisible({ timeout: 10_000 })

    // Cleanup
    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('requests graduation to Category C and approves it', async ({ page }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-GRAD-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '8' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '40000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '4000' },
          { locator: page.getByLabel('MI factor *'), value: '0.08' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    await expect(page.getByRole('heading', { name: accountNumber })).toBeVisible()

    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]

    // Request graduation to Category C, then approve it (Business Owner has approve permission)
    await page.getByRole('button', { name: 'Request graduation to Category C' }).click()
    await expect(page.getByText('Pending graduation to Category C')).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText('Pending graduation to Category C')).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(page.locator('span', { hasText: /^c$/i }).first()).toBeVisible()

    // Cleanup — InstallmentAccountService.remove() now cascades the
    // CategoryGraduationRequest rows for this account first (they're ON
    // DELETE RESTRICT), so this succeeds even though a graduation request
    // was just filed and approved.
    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('settles an active account early via the Settle early action', async ({ page }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-PO-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '10' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '30000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '5000' },
          { locator: page.getByLabel('MI factor *'), value: '0.09' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]

    await clickStable(
      page.getByRole('button', { name: 'Settle early' }),
      page.getByRole('heading', { name: 'Settle account early' })
    )
    await submitStable(
      () =>
        fillAllStable([
          { locator: page.getByLabel('Payoff amount (₱) *'), value: '20000' },
          { locator: page.getByLabel('Paid at *'), value: '2026-08-01' },
        ]),
      () => page.getByRole('button', { name: 'Settle account' }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Settle account early' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )

    await expect(page.getByText('early closed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('₱0.00').first()).toBeVisible()
    // Settled accounts can no longer be paid or re-settled
    await expect(page.getByRole('button', { name: 'Settle early' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0)

    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('filters the installment accounts list by category and status', async ({ page }) => {
    await gotoReady(page, '/crm/installment-accounts')
    await expect(page.getByRole('heading', { name: 'Installment Accounts' })).toBeVisible()
    // Smoke-check the filter controls exist and are operable (full filtering
    // correctness — where clause construction — is already covered by the
    // backend e2e suite's findAll tests).
    await page.getByRole('combobox').nth(0).selectOption('A')
    await expect(page.getByRole('combobox').nth(0)).toHaveValue('A')
    await page.getByRole('combobox').nth(2).selectOption('closed')
    await expect(page.getByRole('combobox').nth(2)).toHaveValue('closed')
  })
})

test.describe('CRM — Collection Incentives', () => {
  test('Category A auto-approves; Category C requires approval and can then be approved', async ({
    page,
  }) => {
    const suffix = Date.now()
    const shortSuffix = String(suffix).slice(-8)
    const stubNumber = `E2E-${shortSuffix}`
    const collectorName = `E2E Incentive Collector ${suffix}`

    await gotoReady(page, '/crm/collectors/new')
    await submitStable(
      () =>
        fillAllStable([
          { locator: page.getByLabel('Stub number *'), value: stubNumber },
          { locator: page.getByLabel('Name *'), value: collectorName },
        ]),
      () => page.getByRole('button', { name: 'Create collector' }).click(),
      () => expect(page).toHaveURL(/\/crm\/collectors\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const collectorId = page.url().match(/\/crm\/collectors\/([a-f0-9-]+)$/)?.[1]

    const period = '2026-07'

    await gotoReady(page, '/crm/collection-incentives')
    await expect(page.getByRole('heading', { name: 'Collection Incentives' })).toBeVisible()

    // Category A — auto-approves immediately
    await clickStable(
      page.getByRole('button', { name: 'New incentive' }),
      page.getByRole('heading', { name: 'New collection incentive' })
    )
    await submitStable(
      async () => {
        await selectStable(page.getByLabel('Collector *'), collectorId!)
        await selectStable(page.getByLabel('Category *'), 'A')
        await fillAllStable([
          { locator: page.getByLabel('Period *'), value: period },
          { locator: page.getByLabel('Amount (₱) *'), value: '1000' },
        ])
      },
      () => page.getByRole('button', { name: 'Create incentive' }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'New collection incentive' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )

    const row = page.locator('tr', { has: page.getByText(collectorName) }).first()
    await expect(row.getByText('auto approved')).toBeVisible({ timeout: 10_000 })

    // Category C — requires approval
    await clickStable(
      page.getByRole('button', { name: 'New incentive' }),
      page.getByRole('heading', { name: 'New collection incentive' })
    )
    await submitStable(
      async () => {
        await selectStable(page.getByLabel('Collector *'), collectorId!)
        await selectStable(page.getByLabel('Category *'), 'C')
        await fillAllStable([
          { locator: page.getByLabel('Period *'), value: period },
          { locator: page.getByLabel('Amount (₱) *'), value: '500' },
        ])
      },
      () => page.getByRole('button', { name: 'Create incentive' }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'New collection incentive' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )

    const pendingRow = page
      .locator('tr', { has: page.getByText(collectorName) })
      .filter({ has: page.getByText('pending approval') })
      .first()
    await expect(pendingRow).toBeVisible({ timeout: 10_000 })

    // Approve it via the row action
    await pendingRow.getByTitle('Approve').click()
    await expect(
      page
        .locator('tr', { has: page.getByText(collectorName) })
        .filter({ has: page.getByText('₱500.00') })
        .getByText('approved', { exact: true })
    ).toBeVisible({ timeout: 10_000 })

    // Cleanup — delete both incentives, then the collector (no remittances
    // recorded against it in this test, so the delete succeeds outright)
    const list = await page.request.get(
      `/api/crm/collection-incentives?collectorId=${collectorId}&period=${period}&limit=50`
    )
    const listBody = await list.json()
    for (const incentive of listBody.data as { id: string }[]) {
      const del = await page.request.delete(`/api/crm/collection-incentives/${incentive.id}`)
      expect(del.ok()).toBeTruthy()
    }
    const delCollector = await page.request.delete(`/api/crm/collectors/${collectorId}`)
    expect(delCollector.ok()).toBeTruthy()
  })
})

test.describe('CRM — Installment Account collections reminders (Scenario 20 NAMIDRe)', () => {
  let createdCustomerIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, CUSTOMER_NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await deleteCustomers(request, createdCustomerIds)
    createdCustomerIds = []
  })

  test('schedules a reminder against an installment account and completes it with outcome/contact phone', async ({
    page,
  }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-NDR-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '10' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '30000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '5000' },
          { locator: page.getByLabel('MI factor *'), value: '0.0954' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]
    expect(accountId).toBeTruthy()

    await expect(page.getByText('No reminders logged for this account yet.')).toBeVisible({
      timeout: 10_000,
    })

    // Schedule a NAMIDRe reminder directly against this installment account
    // (no customer/lead relation — the whole point of the linkage this
    // section exists to exercise).
    await clickStable(
      page.getByRole('button', { name: 'Schedule reminder' }),
      page.getByRole('heading', { name: 'Schedule reminder' })
    )
    await submitStable(
      async () => {
        await selectStable(page.locator('#reminder-type'), 'call')
        await fillStable(page.locator('#reminder-due-at'), '2026-08-10T09:00')
        await fillStable(page.locator('#reminder-note'), 'NAMIDRe follow-up call')
      },
      () => page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Schedule reminder' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )

    await expect(page.getByText('NAMIDRe follow-up call')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('No reminders logged for this account yet.')).toHaveCount(0)

    // Complete it with outcome + contact phone — confirms the complete()
    // call now carries a real body instead of firing empty.
    await clickStable(
      page.getByRole('button', { name: 'Complete' }),
      page.getByRole('heading', { name: 'Complete reminder' })
    )
    await submitStable(
      () =>
        fillAllStable([
          { locator: page.locator('#complete-reminder-phone'), value: '+639171234567' },
          {
            locator: page.locator('#complete-reminder-outcome'),
            value: 'Reached customer, promised to pay by Friday',
          },
        ]),
      () => page.locator('form').getByRole('button', { name: 'Complete' }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Complete reminder' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )

    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Complete' })).toHaveCount(0)

    // Confirm the auto-logged interaction picked up the outcome/contactPhone
    // (no interactions UI exists yet — assert via the API directly).
    const interactions = await page.request.get(
      `/api/crm/interactions?installmentAccountId=${accountId}&limit=5`
    )
    const interactionsBody = await interactions.json()
    const logged = (interactionsBody.data as { outcome?: string; contactPhone?: string }[]).find(
      (i) => i.outcome === 'Reached customer, promised to pay by Friday'
    )
    expect(logged?.contactPhone).toBe('+639171234567')

    // Cleanup
    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('blocks scheduling a second open reminder on the same account until the first is completed', async ({
    page,
  }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-DUP-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '10' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '30000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '5000' },
          { locator: page.getByLabel('MI factor *'), value: '0.0954' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]

    // First reminder schedules fine
    await clickStable(
      page.getByRole('button', { name: 'Schedule reminder' }),
      page.getByRole('heading', { name: 'Schedule reminder' })
    )
    await submitStable(
      async () => {
        await fillStable(page.locator('#reminder-due-at'), '2026-08-10T09:00')
        await fillStable(page.locator('#reminder-note'), 'First open task')
      },
      () => page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Schedule reminder' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )
    await expect(page.getByText('First open task')).toBeVisible({ timeout: 10_000 })

    // Second reminder is rejected with a clear inline error, and the modal
    // stays open (nothing was silently lost).
    await clickStable(
      page.getByRole('button', { name: 'Schedule reminder' }),
      page.getByRole('heading', { name: 'Schedule reminder' })
    )
    await fillStable(page.locator('#reminder-due-at'), '2026-08-11T09:00')
    await fillStable(page.locator('#reminder-note'), 'Duplicate task attempt')
    await page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click()
    await expect(
      page.getByText(
        'This account already has an open reminder. Complete it before scheduling a new one.'
      )
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Schedule reminder' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Duplicate task attempt')).toHaveCount(0)

    // Complete the first one, then scheduling a new reminder succeeds again
    await clickStable(
      page.getByRole('button', { name: 'Complete' }),
      page.getByRole('heading', { name: 'Complete reminder' })
    )
    await page.locator('form').getByRole('button', { name: 'Complete', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Complete reminder' })).toHaveCount(0, {
      timeout: 8_000,
    })
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10_000 })

    await clickStable(
      page.getByRole('button', { name: 'Schedule reminder' }),
      page.getByRole('heading', { name: 'Schedule reminder' })
    )
    await submitStable(
      async () => {
        await fillStable(page.locator('#reminder-due-at'), '2026-08-12T09:00')
        await fillStable(page.locator('#reminder-note'), 'New task after completion')
      },
      () => page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Schedule reminder' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )
    await expect(page.getByText('New task after completion')).toBeVisible({ timeout: 10_000 })

    // Cleanup
    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('recording a payment auto-closes the account’s open reminder', async ({ page }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-AUTOCLOSE-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '10' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '30000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '5000' },
          { locator: page.getByLabel('MI factor *'), value: '0.0954' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]

    // Schedule an open reminder
    await clickStable(
      page.getByRole('button', { name: 'Schedule reminder' }),
      page.getByRole('heading', { name: 'Schedule reminder' })
    )
    await submitStable(
      async () => {
        await fillStable(page.locator('#reminder-due-at'), '2026-08-10T09:00')
        await fillStable(page.locator('#reminder-note'), 'Task to be auto-closed by payment')
      },
      () => page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Schedule reminder' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )
    await expect(page.getByText('Task to be auto-closed by payment')).toBeVisible({
      timeout: 10_000,
    })

    // Record a payment via the existing Record payment flow
    await clickStable(
      page.getByRole('button', { name: 'Record payment' }),
      page.getByRole('heading', { name: 'Record payment' })
    )
    await submitStable(
      () =>
        fillAllStable([
          { locator: page.getByLabel('Amount (₱) *'), value: '1000' },
          { locator: page.getByLabel('Due date *'), value: '2026-08-15' },
          { locator: page.getByLabel('Paid at *'), value: '2026-08-10' },
        ]),
      () => page.locator('form').getByRole('button', { name: 'Record payment' }).click(),
      () => expect(page.getByText(/on time, \+1 point earned/i)).toBeVisible({ timeout: 8_000 })
    )
    await page.getByRole('button', { name: 'Done' }).click()

    // The reminders section refreshes on its own — no manual page reload —
    // and shows the task as Completed.
    await expect(page.getByText('Task to be auto-closed by payment')).toBeVisible({
      timeout: 10_000,
    })
    const reminderRow = page.locator('li', { hasText: 'Task to be auto-closed by payment' })
    await expect(reminderRow.getByText('Completed', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(reminderRow.getByRole('button', { name: 'Complete' })).toHaveCount(0)

    const interactions = await page.request.get(
      `/api/crm/interactions?installmentAccountId=${accountId}&limit=5`
    )
    const interactionsBody = await interactions.json()
    const logged = (interactionsBody.data as { outcome?: string }[]).find((i) =>
      i.outcome?.startsWith('Auto-closed — payment posted')
    )
    expect(logged).toBeTruthy()

    // Cleanup
    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('captures a structured Promise to Pay when completing a reminder', async ({ page }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-PTP-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '10' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '30000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '5000' },
          { locator: page.getByLabel('MI factor *'), value: '0.0954' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]

    await clickStable(
      page.getByRole('button', { name: 'Schedule reminder' }),
      page.getByRole('heading', { name: 'Schedule reminder' })
    )
    await submitStable(
      async () => {
        await fillStable(page.locator('#reminder-due-at'), '2026-08-10T09:00')
        await fillStable(page.locator('#reminder-note'), 'PTP capture test')
      },
      () => page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Schedule reminder' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )
    await expect(page.getByText('PTP capture test')).toBeVisible({ timeout: 10_000 })

    // Checking "Mark as Promise to Pay" without a date is rejected client-side
    await clickStable(
      page.getByRole('button', { name: 'Complete' }),
      page.getByRole('heading', { name: 'Complete reminder' })
    )
    await page.getByLabel('Mark as Promise to Pay').check()
    await page.locator('#complete-reminder-ptp-amount').fill('2500')
    await page.locator('form').getByRole('button', { name: 'Complete', exact: true }).click()
    await expect(page.getByText('A committed date is required for a Promise to Pay')).toBeVisible({
      timeout: 5_000,
    })
    await expect(page.getByRole('heading', { name: 'Complete reminder' })).toBeVisible()

    // Filling in the date lets it through
    await page.locator('#complete-reminder-ptp-date').fill('2026-08-20')
    await page.locator('form').getByRole('button', { name: 'Complete', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Complete reminder' })).toHaveCount(0, {
      timeout: 8_000,
    })
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10_000 })

    const interactions = await page.request.get(
      `/api/crm/interactions?installmentAccountId=${accountId}&limit=5`
    )
    const interactionsBody = await interactions.json()
    const logged = (
      interactionsBody.data as { isPromiseToPay?: boolean; ptpAmount?: string; ptpDate?: string }[]
    ).find((i) => i.isPromiseToPay)
    expect(logged).toBeTruthy()
    expect(Number(logged?.ptpAmount)).toBe(2500)
    expect(logged?.ptpDate).toContain('2026-08-20')

    // Cleanup
    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('the legal escalation section only appears once the account is in DAM, and its status is editable', async ({
    page,
  }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-LEGAL-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '10' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '30000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '5000' },
          { locator: page.getByLabel('MI factor *'), value: '0.0954' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]

    // Not in DAM yet — section is absent
    await expect(page.getByRole('heading', { name: 'Legal escalation' })).toHaveCount(0)

    // Move it into DAM via the edit form's classification field
    await gotoReady(page, `/crm/installment-accounts/${accountId}/edit`)
    await page.getByLabel('Classification').selectOption('not_moving')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.waitForURL(`/crm/installment-accounts/${accountId}`, { timeout: 15_000 })

    await expect(page.getByRole('heading', { name: 'Legal escalation' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator('#legal-escalation-status')).toHaveValue('none')

    await page.locator('#legal-escalation-status').selectOption('soa_prepared')
    await page.locator('#legal-escalation-notes').fill('SOA drafted, awaiting BM sign-off')
    await page.getByRole('button', { name: 'Update' }).click()

    await expect(page.locator('#legal-escalation-status')).toHaveValue('soa_prepared', {
      timeout: 10_000,
    })
    await expect(page.locator('#legal-escalation-notes')).toHaveValue(
      'SOA drafted, awaiting BM sign-off'
    )
    await expect(page.getByText(/Last updated/)).toBeVisible()

    // Cleanup
    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })

  test('the global Reminders page shows a linked account badge for collections tasks', async ({
    page,
  }) => {
    const suffix = Date.now()
    const { fullName, customerId } = await createCustomerViaUi(page, suffix)
    createdCustomerIds.push(customerId)

    const accountNumber = `E2E-IA-CTX-${suffix}`
    await gotoReady(page, '/crm/installment-accounts/new')
    await submitStable(
      async () => {
        await pickCustomer(page, fullName.split(' ')[1], fullName)
        await fillAllStable([
          { locator: page.getByLabel('Account number *'), value: accountNumber },
          { locator: page.getByLabel('Term (months) *'), value: '10' },
          { locator: page.getByLabel('Listed cash price (₱) *'), value: '30000' },
          { locator: page.getByLabel('Down payment (₱) *'), value: '5000' },
          { locator: page.getByLabel('MI factor *'), value: '0.0954' },
        ])
      },
      () => page.getByRole('button', { name: 'Create account' }).click(),
      () => expect(page).toHaveURL(/\/crm\/installment-accounts\/[a-f0-9-]+$/, { timeout: 8_000 })
    )
    const accountId = page.url().match(/\/crm\/installment-accounts\/([a-f0-9-]+)$/)?.[1]

    await clickStable(
      page.getByRole('button', { name: 'Schedule reminder' }),
      page.getByRole('heading', { name: 'Schedule reminder' })
    )
    await submitStable(
      async () => {
        await fillStable(page.locator('#reminder-due-at'), '2026-08-10T09:00')
        await fillStable(
          page.locator('#reminder-note'),
          `Global reminders context badge test ${suffix}`
        )
      },
      () => page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Schedule reminder' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )

    await gotoReady(page, '/crm/reminders')
    await expect(page.getByText(`Global reminders context badge test ${suffix}`)).toBeVisible({
      timeout: 10_000,
    })

    const badge = page.getByRole('link', { name: accountNumber })
    await expect(badge).toBeVisible()
    await badge.click()
    await expect(page).toHaveURL(`/crm/installment-accounts/${accountId}`, { timeout: 10_000 })

    // Cleanup
    const del = await page.request.delete(`/api/crm/installment-accounts/${accountId}`)
    expect(del.ok()).toBeTruthy()
  })
})
