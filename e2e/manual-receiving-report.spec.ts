import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, fillAllStable } from './utils'

// Scenario 29 RR-05 — manual receiving report: origination path for a
// serial with no PO/transfer/count context. Owner-only by default, async
// submit-then-approve, self-approval blocked. Covers:
//  - Business Owner submits via the UI (item search, warehouse select,
//    serial input, reason select) and it lands as "Pending Approval".
//  - Self-approval is blocked at the UI level too — opening the report as
//    its own submitter shows no Approve/Reject buttons.
//  - A genuinely distinct second permission-holder (Branch Manager,
//    granted the permission for the duration of this test via the same
//    REST endpoint the Roles & Access UI itself uses) sees Approve/Reject
//    and a successful approve moves the report to "Approved".
//
// Branch Manager doesn't hold inventory:manual-rr:create by default (it's
// owner-only), so this test grants it via POST /roles/:id/permissions
// (merged onto the role's existing list — that endpoint fully replaces,
// so the original list is restored afterward, not just the one addition
// removed).

const DEV_PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
const MANAGER_EMAIL = 'technova.b1.manager@test.com'

test.describe('Inventory — Manual Receiving Report (Scenario 29 RR-05)', () => {
  let managerRoleId: string
  let originalManagerPermissionIds: string[]
  let manualRrPermissionId: string

  test.beforeAll(async ({ request }) => {
    const rolesRes = await request.get('/api/roles')
    const roles = (await rolesRes.json()) as { id: string; name: string }[]
    const managerRole = roles.find((r) => r.name === 'Branch Manager')
    if (!managerRole) throw new Error('Branch Manager role not found')
    managerRoleId = managerRole.id

    const permsRes = await request.get('/api/permissions')
    const perms = (await permsRes.json()) as {
      id: string
      module: string
      resource: string
      action: string
    }[]
    const manualRrPerm = perms.find(
      (p) => p.module === 'inventory' && p.resource === 'manual-rr' && p.action === 'create'
    )
    if (!manualRrPerm) throw new Error('inventory:manual-rr:create permission not found')
    manualRrPermissionId = manualRrPerm.id

    const roleDetailRes = await request.get(`/api/roles/${managerRoleId}`)
    const roleDetail = (await roleDetailRes.json()) as {
      permissions: { permissionId: string }[]
    }
    originalManagerPermissionIds = roleDetail.permissions.map((rp) => rp.permissionId)

    const grantRes = await request.post(`/api/roles/${managerRoleId}/permissions`, {
      data: { permissionIds: [...originalManagerPermissionIds, manualRrPermissionId] },
    })
    expect(grantRes.ok()).toBeTruthy()
  })

  test.afterAll(async ({ request }) => {
    await request.post(`/api/roles/${managerRoleId}/permissions`, {
      data: { permissionIds: originalManagerPermissionIds },
    })
  })

  test('Business Owner submits, self-approval is hidden, a distinct Branch Manager approves', async ({
    page,
  }) => {
    const uniqueSerial = `E2E-MANUAL-RR-${Date.now()}`

    // ── Submit as Business Owner ──────────────────────────────────────────
    await gotoReady(page, '/inventory/counting?tab=manual-rr')
    await page.getByRole('button', { name: 'New Manual RR' }).click()
    await expect(page.getByRole('heading', { name: 'New Manual Receiving Report' })).toBeVisible({
      timeout: 10_000,
    })

    const itemInput = page.getByPlaceholder('Search item by name or SKU…')
    await itemInput.click()
    await itemInput.fill('TN-FURN-SET-001')
    const itemOption = page.getByRole('button', { name: /TN-FURN-SET-001/ }).first()
    await expect(itemOption).toBeVisible({ timeout: 10_000 })
    await itemOption.click()

    const modal = page.locator('.fixed.inset-0.z-50')
    // Must be Bago specifically — that's technova.b1.manager@test.com's own
    // branch, and the list/detail is branch-scoped for a branch-assigned
    // caller (same convention as every other branch-tied resource in this
    // app), so the second-approver step below needs the report to actually
    // be visible to that Branch Manager.
    await modal.locator('select').first().selectOption({ label: 'Bago' })
    await fillAllStable([
      {
        locator: modal.getByPlaceholder('Exactly as printed on the physical unit'),
        value: uniqueSerial,
      },
    ])
    await modal.locator('select').nth(1).selectOption('found')

    await expect(async () => {
      await modal.getByRole('button', { name: 'Submit' }).click()
      await expect(page.getByRole('heading', { name: 'New Manual Receiving Report' })).toHaveCount(
        0,
        { timeout: 3_000 }
      )
    }).toPass({ timeout: 15_000 })

    // ── Confirm it landed, pending, and self-approval is hidden ───────────
    const row = page.locator('tbody tr', { hasText: uniqueSerial })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText('Pending Approval')
    await row.click()

    const detailModal = page.locator('.fixed.inset-0.z-50')
    await expect(detailModal.getByText('Pending Approval')).toBeVisible({ timeout: 10_000 })
    await expect(detailModal.getByText('You submitted this report', { exact: false })).toBeVisible()
    await expect(detailModal.getByRole('button', { name: 'Approve' })).toHaveCount(0)
    await expect(detailModal.getByRole('button', { name: 'Reject' })).toHaveCount(0)
    await detailModal.getByRole('button', { name: 'Close dialog' }).click()

    // ── Switch to a distinct, genuinely permitted second approver ─────────
    await page.context().clearCookies()
    await loginAs(page, MANAGER_EMAIL, DEV_PASSWORD)

    await gotoReady(page, '/inventory/counting?tab=manual-rr')
    const managerRow = page.locator('tbody tr', { hasText: uniqueSerial })
    await expect(managerRow).toBeVisible({ timeout: 15_000 })
    await managerRow.click()

    const managerDetailModal = page.locator('.fixed.inset-0.z-50')
    const approveButton = managerDetailModal.getByRole('button', { name: 'Approve' })
    await expect(approveButton).toBeVisible({ timeout: 10_000 })
    await approveButton.click()

    await expect(managerDetailModal.getByText('Approved', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(managerDetailModal.getByText('originated, now in stock')).toBeVisible()
  })
})
