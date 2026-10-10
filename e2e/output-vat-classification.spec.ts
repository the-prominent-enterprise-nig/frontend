/**
 * Scenario 69 Part F — output VAT classification.
 *
 * A POS sale and an AR invoice each carry one output VAT class. VATable is the
 * default; zero-rated and VAT-exempt are restricted — they need the
 * certificate they rest on and an approver (a manager's PIN at the register;
 * accounting:ar-invoices:restricted-vat on an invoice).
 *
 * Self-cleaning: the customers it creates are deleted, and so are the draft
 * invoices (the app only hides a deleted draft, like every other spec that
 * makes one). No sale is ever submitted — the register is only driven as far
 * as its approval prompt; the backend e2e (scenario-69-output-vat.e2e-spec.ts)
 * covers the posting.
 *
 * Needs the Part F migration applied to the DB the stack runs against.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

const createdCustomerIds: string[] = []
const createdInvoiceIds: string[] = []

test.afterEach(async ({ request }) => {
  for (const id of createdInvoiceIds.splice(0)) {
    await request.delete(`/api/ar-invoices/${id}`).catch(() => {})
  }
  for (const id of createdCustomerIds.splice(0)) {
    await request.delete(`/api/crm/customers/${id}`).catch(() => {})
  }
})

/** A button whose onClick only attaches once the page has hydrated: click until
 * the expected result shows up. */
async function clickUntil(button: Locator, expected: Locator): Promise<void> {
  await expect(async () => {
    await button.click({ timeout: 2_000 })
    await expect(expected).toBeVisible({ timeout: 1_500 })
  }).toPass({ timeout: 20_000 })
}

async function makeCustomer(
  page: Page,
  over: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
  const name = `E2E S69F ${Date.now()} ${Math.floor(Math.random() * 1000)}`
  const res = await page.request.post('/api/crm/customers', {
    data: { name, customerType: 'individual', phone: '09170006655', ...over },
  })
  expect(res.ok(), await res.text()).toBe(true)
  const customer = await res.json()
  createdCustomerIds.push(customer.id)
  return { id: customer.id, name }
}

test.describe('POS checkout — VAT treatment', () => {
  test('is VATable until a restricted class is picked, which asks for its certificate and a manager', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    const treatment = page.getByTestId('vat-treatment')
    await expect(treatment).toBeVisible({ timeout: 30_000 })

    const vatable = treatment.getByRole('radio', { name: 'VATable' })
    const zeroRated = treatment.getByRole('radio', { name: 'Zero-rated' })
    const exempt = treatment.getByRole('radio', { name: 'VAT-exempt' })
    await expect(vatable).toHaveAttribute('aria-checked', 'true')
    await expect(zeroRated).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('vat-treatment-restricted')).toHaveCount(0)

    // VAT-exempt: the certificate field and the approval prompt appear.
    const restricted = page.getByTestId('vat-treatment-restricted')
    await clickUntil(exempt, restricted)
    await expect(exempt).toHaveAttribute('aria-checked', 'true')
    await expect(vatable).toHaveAttribute('aria-checked', 'false')
    await expect(restricted.getByLabel('Certificate or exemption reference')).toBeVisible()
    await expect(restricted).toContainText("A VAT-exempt sale needs a manager's approval")
    // Not the VATable default, so the sale also has to say why (Scenario 69 Part I).
    await expect(
      page.getByTestId('vat-override').getByLabel('Reason the VAT treatment was changed')
    ).toBeVisible()

    // Zero-rated asks the same, in its own words, and drops the old certificate.
    await restricted.getByLabel('Certificate or exemption reference').fill('CERT-ONE')
    await zeroRated.click()
    await expect(restricted).toContainText("A zero-rated sale needs a manager's approval")
    await expect(restricted.getByLabel('Certificate or exemption reference')).toHaveValue('')

    // Back to VATable: nothing left to ask.
    await vatable.click()
    await expect(page.getByTestId('vat-treatment-restricted')).toHaveCount(0)
    await expect(page.getByTestId('vat-override')).toHaveCount(0)
  })

  test('approving opens the manager PIN prompt, which says why', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    const treatment = page.getByTestId('vat-treatment')
    await expect(treatment).toBeVisible({ timeout: 30_000 })

    const restricted = page.getByTestId('vat-treatment-restricted')
    await clickUntil(treatment.getByRole('radio', { name: 'VAT-exempt' }), restricted)
    await restricted.getByRole('button', { name: 'Approve' }).click()

    const prompt = page.getByRole('heading', { name: 'Manager Override' })
    await expect(prompt).toBeVisible()
    await expect(page.getByText('This is a VAT-exempt sale.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(prompt).toBeHidden()
  })

  test('picking a customer registered as VAT-exempt starts the sale VAT-exempt, with their certificate', async ({
    page,
  }) => {
    const customer = await makeCustomer(page, {
      isTaxExempt: true,
      taxExemptionRef: 'BIR-PROFILE-CERT-77',
    })

    await gotoReady(page, '/pos/checkout')
    const treatment = page.getByTestId('vat-treatment')
    await expect(treatment).toBeVisible({ timeout: 30_000 })

    const search = page.getByPlaceholder('Search by name or phone…')
    const hit = page.getByText(customer.name, { exact: true })
    await expect(async () => {
      await search.fill(customer.name)
      await expect(hit).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await hit.click()

    await expect(treatment.getByRole('radio', { name: 'VAT-exempt' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await expect(
      page.getByTestId('vat-treatment-restricted').getByLabel('Certificate or exemption reference')
    ).toHaveValue('BIR-PROFILE-CERT-77')

    // VAT-exempt is this customer's default, so nothing is being changed and
    // nothing is asked. Ringing them up VATable is the change (Scenario 69 Part I).
    const reason = page.getByTestId('vat-override')
    await expect(reason).toHaveCount(0)
    await treatment.getByRole('radio', { name: 'VATable' }).click()
    await expect(reason.getByLabel('Reason the VAT treatment was changed')).toHaveAttribute(
      'placeholder',
      /Why is this not VAT-exempt\?/
    )
  })
})

test.describe('AR invoice — its own page, with a VAT treatment', () => {
  const taxField = (page: Page) =>
    page.locator('label', { hasText: /^Tax/ }).locator('input').first()

  test('is VATable by default with the tax following the subtotal; a restricted class carries none', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/ar-invoices/new')
    await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible({
      timeout: 30_000,
    })
    const treatment = page.getByTestId('invoice-vat-treatment')
    const vatable = treatment.getByRole('radio', { name: 'VATable' })
    const zeroRated = treatment.getByRole('radio', { name: 'Zero-rated' })
    const exempt = treatment.getByRole('radio', { name: 'VAT-exempt' })
    await expect(vatable).toHaveAttribute('aria-checked', 'true')
    // The government class waits for the accountant to switch it on.
    await expect(treatment.getByRole('radio', { name: 'Government' })).toHaveCount(0)

    // 12% of the subtotal, as it always was.
    await fillStable(page.getByLabel('Subtotal *'), '1000')
    await expect(taxField(page)).toHaveValue('120')
    await expect(page.getByTestId('invoice-total')).toContainText('1,120.00')

    // Exempt: no tax, a certificate to give, and the approver is the saver.
    const restricted = page.getByTestId('invoice-vat-restricted')
    await clickUntil(exempt, restricted)
    await expect(taxField(page)).toBeDisabled()
    await expect(taxField(page)).toHaveValue('0')
    await expect(page.getByTestId('invoice-total')).toContainText('1,000.00')
    await expect(restricted).toContainText('Saving this records you as the approver.')

    // Zero-rated is the same shape; the certificate does not carry across.
    await restricted.getByPlaceholder('e.g. BIR exemption certificate no.').fill('CERT-ONE')
    await zeroRated.click()
    await expect(restricted.getByPlaceholder('e.g. BIR exemption certificate no.')).toHaveValue('')

    // Back to VATable: the tax is back, the certificate field is gone.
    await vatable.click()
    await expect(page.getByTestId('invoice-vat-restricted')).toHaveCount(0)
    await expect(taxField(page)).toBeEnabled()
    await expect(taxField(page)).toHaveValue('120')
  })

  test('a VAT-exempt customer starts the invoice VAT-exempt, with their certificate', async ({
    page,
  }) => {
    const customer = await makeCustomer(page, {
      isTaxExempt: true,
      taxExemptionRef: 'BIR-INVOICE-CERT-88',
    })
    await gotoReady(page, `/accounting/ar-invoices/new?customerId=${customer.id}`)
    await expect(page.getByPlaceholder('Search by name or phone…')).toHaveValue(customer.name, {
      timeout: 30_000,
    })
    await expect(
      page.getByTestId('invoice-vat-treatment').getByRole('radio', { name: 'VAT-exempt' })
    ).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByPlaceholder('e.g. BIR exemption certificate no.')).toHaveValue(
      'BIR-INVOICE-CERT-88'
    )

    // VAT-exempt is this customer's default: nothing is being changed, so nothing
    // is asked. Billing them VATable is the change (Scenario 69 Part I).
    await expect(page.getByTestId('invoice-override')).toHaveCount(0)
    await page.getByTestId('invoice-vat-treatment').getByRole('radio', { name: 'VATable' }).click()
    await expect(page.getByTestId('invoice-override-changes')).toContainText(
      'Output VAT class: VAT-OUT-EXEMPT → VAT-OUT-12'
    )
    await expect(page.getByTestId('invoice-override-reason')).toBeVisible()
  })

  test('saves a VAT-exempt invoice with its certificate and approver, and the detail says so', async ({
    page,
  }) => {
    const customer = await makeCustomer(page)
    await gotoReady(page, `/accounting/ar-invoices/new?customerId=${customer.id}`)
    await expect(page.getByPlaceholder('Search by name or phone…')).toHaveValue(customer.name, {
      timeout: 30_000,
    })

    await fillStable(page.getByLabel('Subtotal *'), '1000')
    const restricted = page.getByTestId('invoice-vat-restricted')
    await clickUntil(
      page.getByTestId('invoice-vat-treatment').getByRole('radio', { name: 'VAT-exempt' }),
      restricted
    )
    // The certificate is required.
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('form [role="alert"]')).toContainText(
      'Enter the certificate or reference that supports this VAT-exempt invoice'
    )
    await fillStable(
      restricted.getByPlaceholder('e.g. BIR exemption certificate no.'),
      'BIR-EX-E2E-01'
    )

    // A class other than the VATable default has to say why (Scenario 69 Part I):
    // the invoice lists the change, and will not save without the reason.
    await expect(page.getByTestId('invoice-override-changes')).toContainText(
      'Output VAT class: VAT-OUT-12 → VAT-OUT-EXEMPT'
    )
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('form [role="alert"]')).toContainText(
      'Say why this tax code was changed from its default'
    )
    await fillStable(
      page.getByTestId('invoice-override-reason'),
      'Customer showed a BIR certificate'
    )

    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/ar-invoices') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(saved.status()).toBe(201)
    const invoice = await saved.json()
    createdInvoiceIds.push(invoice.id)
    expect(invoice).toMatchObject({
      outputVatCode: 'VAT-OUT-EXEMPT',
      taxExemptionRef: 'BIR-EX-E2E-01',
      taxAmount: 0,
    })
    expect(invoice.outputVatApprovedBy).toBeTruthy()
    // The change is kept with the invoice: what, why, who and when.
    expect(invoice.taxOverride).toEqual([
      expect.objectContaining({
        field: 'OUTPUT_VAT_CODE',
        from: 'VAT-OUT-12',
        to: 'VAT-OUT-EXEMPT',
        reason: 'Customer showed a BIR certificate',
      }),
    ])

    // Lands on the invoice, which names the class, the certificate and the approver.
    await expect(page).toHaveURL(new RegExp(`/accounting/ar-invoices/${invoice.id}$`), {
      timeout: 20_000,
    })
    const cls = page.getByTestId('invoice-vat-class')
    await expect(cls).toContainText('VAT-exempt sale', { timeout: 20_000 })
    await expect(cls).toContainText('BIR-EX-E2E-01')
    await expect(cls).toContainText('approved by')
    // ...and so does the change, with its reason and who made it.
    const changed = page.getByTestId('invoice-override-summary')
    await expect(changed).toContainText('Output VAT class: VAT-OUT-12 → VAT-OUT-EXEMPT')
    await expect(changed).toContainText('Customer showed a BIR certificate')
  })

  test('a saved draft reopens with its class and certificate, and a VATable draft takes none', async ({
    page,
    request,
  }) => {
    const customer = await makeCustomer(page)
    const created = await request.post('/api/ar-invoices', {
      data: {
        customerId: customer.id,
        invoiceDate: '2026-10-10',
        dueDate: '2026-11-10',
        subtotal: 2000,
        taxAmount: 0,
        outputVatCode: 'VAT-OUT-0ZR',
        taxExemptionRef: 'BIR-ZR-E2E-02',
        // zero-rated is not the VATable default: it is saved with why (Scenario 69 Part I)
        taxOverrideReason: 'E2E: export sale',
      },
    })
    expect(created.ok(), await created.text()).toBe(true)
    const invoice = await created.json()
    createdInvoiceIds.push(invoice.id)

    await gotoReady(page, `/accounting/ar-invoices/${invoice.id}/edit`)
    await expect(page.getByRole('heading', { name: /Edit Invoice/ })).toBeVisible({
      timeout: 30_000,
    })
    const treatment = page.getByTestId('invoice-vat-treatment')
    await expect(treatment.getByRole('radio', { name: 'Zero-rated' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await expect(page.getByPlaceholder('e.g. BIR exemption certificate no.')).toHaveValue(
      'BIR-ZR-E2E-02'
    )
    // Already approved as it stands: nobody has to approve it again to keep it.
    await expect(page.getByTestId('invoice-vat-restricted')).toContainText('Approved by')
    // ...and already explained: the change on record stands, and asks nothing more.
    await expect(page.getByTestId('invoice-override')).toContainText('E2E: export sale')
    await expect(page.getByTestId('invoice-override-reason')).toHaveCount(0)

    // Making it VATable adds the tax back and lets the save go through.
    await treatment.getByRole('radio', { name: 'VATable' }).click()
    await expect(taxField(page)).toHaveValue('240')
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/ar-invoices/${invoice.id}`) && r.request().method() === 'PATCH'
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(saved.status()).toBe(200)
    const kept = await saved.json()
    expect(kept).toMatchObject({
      outputVatCode: 'VAT-OUT-12',
      taxExemptionRef: null,
      outputVatApprovedBy: null,
      taxAmount: 240,
    })
    // Back on the default there is nothing left to explain.
    expect(kept.taxOverride ?? []).toEqual([])
  })
})
