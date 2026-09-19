---
list: '01 - Business & Tenant (TEN)'
list_id: '901615166750'
last_synced: '2026-06-10'
---

# Business & Tenant Tickets

## Summary

| ID    | Title                                                                                     | Status | Priority |
| ----- | ----------------------------------------------------------------------------------------- | ------ | -------- |
| TEN-1 | AA Employee, ISBAT see only enabled modules and finished pages in the navigation          | TO DO  | high     |
| TEN-2 | AA Inventory Manager, ISBAT navigate with breadcrumbs on all nested pages                 | TO DO  | normal   |
| TEN-3 | AA Cashier, ISBAT rely on consistent, focus-trapped confirmation dialogs                  | TO DO  | normal   |
| TEN-4 | AA Accountant, ISBAT recover gracefully from request failures via a global error boundary | TO DO  | normal   |

---

## Tickets

### [TEN-1] — AA Employee, ISBAT see only enabled modules and finished pages in the navigation

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aatac

---

**Scenario:**
The sidebar currently exposes 50+ routes including "Coming Soon" placeholders (`/workspace/*`, `/settings/system`, `/settings/export`) and stub pages from modules outside the NIG scope. During UAT, clients clicking into placeholders erodes trust. Navigation must render only modules enabled for the tenant and hide routes whose pages are placeholders.

**Given:**

- The tenant has a set of enabled modules (POS, Inventory, Accounting, CRM, Reports, Audit for NIG)
- The user's permissions restrict visible entries further

**When:**

- The employee logs in and views the sidebar

**Then:**
The system should:

- Render nav sections only for enabled modules (driven by tenant module config, not hardcoded)
- Hide links to placeholder/ComingSoon pages entirely
- Return 404/403 (not a placeholder page) when a disabled module route is accessed directly
- Keep the permission-based filtering that already exists

### Sections

- **Sidebar:** module groups → feature links, both gated
- **Direct URL access:** guarded at layout level

### Buttons

- N/A (navigation behavior)

---

#### Empty States

- A user with a single module sees only that module group, no empty headers

---

#### Post-Action Behavior

- Module enable/disable via super-admin reflects in nav on next session load

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-1

**Title:** FE: Module-config-driven sidebar + placeholder route removal
**Parent:** TEN-1
**Contract:** `contracts/tenant/module-navigation.contract.md`

**Scope:**

- [ ] Nav config consumes tenant enabled-modules from session/enterprise payload
- [ ] Remove or guard ComingSoon routes (`/workspace/*`, `/settings/system`, `/settings/export`)
- [ ] Layout-level guard returns 404/403 for disabled module routes
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- No placeholder page reachable via nav or direct URL for NIG tenant config

---

### SUBTASK (Backend) — BE-TEN-1-modules

**Title:** BE: Expose enabled modules in session/enterprise payload
**Parent:** TEN-1
**Contract:** `contracts/tenant/module-navigation.contract.md`

**Scope:**

- [ ] Session/enterprise endpoint returns `enabledModules: string[]`
- [ ] Module guard rejects API calls to disabled modules with `MODULE_DISABLED`
- [ ] Auth: bearer token

**Acceptance Criteria:**

- Module list MUST come from the enterprise module assignment, not constants

---

### [TEN-2] — AA Inventory Manager, ISBAT navigate with breadcrumbs on all nested pages

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3aatba

---

**Scenario:**
Deep pages (e.g. item detail, lead edit, fiscal periods) have no trail showing where the user is; the sidebar is the only orientation. A breadcrumb trail derived from the route renders on every dashboard page with clickable ancestors.

**Given:**

- The inventory manager is on any nested dashboard route (2+ levels deep)

**When:**

- The page renders

**Then:**
The system should:

- Show a breadcrumb trail: Module → Section → Page (e.g. Inventory → Items → ITM-00123)
- Make all ancestors clickable; current page is plain text
- Resolve dynamic segments to entity names (item name, customer name) once loaded, with skeleton before

### Sections

- **Breadcrumb bar:** below header, consistent placement on all dashboard pages

### Buttons

- N/A

---

#### Empty States

- Top-level module pages show just the module crumb

---

#### Post-Action Behavior

- Renames reflect in the crumb after entity refresh

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-2

**Title:** FE: Route-derived breadcrumb component in dashboard layout
**Parent:** TEN-2
**Contract:** `contracts/tenant/breadcrumbs.contract.md`

**Scope:**

- [ ] Breadcrumb component mapping route segments to labels
- [ ] Entity-name resolution hook for dynamic segments
- [ ] Render in `(dashboard)` layout once, all pages inherit

**Acceptance Criteria:**

- Every dashboard route 2+ levels deep MUST show a correct trail

---

### SUBTASK (Backend) — BE-TEN-2-none

**Title:** BE: N/A — frontend-only ticket
**Parent:** TEN-2
**Contract:** `contracts/tenant/breadcrumbs.contract.md`

**Scope:**

- [ ] No backend work; existing detail endpoints provide entity names

**Acceptance Criteria:**

- N/A

---

### [TEN-3] — AA Cashier, ISBAT rely on consistent, focus-trapped confirmation dialogs

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3aatbw

---

**Scenario:**
Modal styling varies (`max-w-sm/md/lg`, `rounded-xl/2xl`) and dialogs don't trap keyboard focus, so Tab escapes into the page behind. One shared dialog component standardizes sizing, destructive styling, and accessibility, and all destructive actions (void, delete, archive, close session) use it.

**Given:**

- The cashier triggers any destructive or confirm-required action

**When:**

- The dialog opens

**Then:**
The system should:

- Trap focus inside the dialog (Tab cycles within; Esc closes; initial focus on cancel for destructive actions)
- Use one standard size scale and consistent destructive styling (red confirm, secondary cancel)
- Summarize the action and its irreversibility in the body
- Restore focus to the trigger element on close

### Sections

- **Shared dialog component:** variants — confirm, destructive, form

### Buttons

- **Confirm (destructive red)** / **Cancel**
  - Confirm disabled while the action request is in flight

---

#### Empty States

- N/A

---

#### Post-Action Behavior

- Success toast; dialog closes; focus restored

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-3

**Title:** FE: Shared ConfirmDialog (Radix) + migrate destructive actions
**Parent:** TEN-3
**Contract:** `contracts/tenant/confirm-dialog.contract.md`

**Scope:**

- [ ] Build shared dialog on Radix Dialog primitives (focus trap built in)
- [ ] Migrate void transaction, delete user/role, archive customer, close session dialogs
- [ ] Audit remaining destructive actions and migrate

**Acceptance Criteria:**

- Tab/Shift-Tab MUST stay within an open dialog; Esc closes; trigger refocused on close

---

### SUBTASK (Backend) — BE-TEN-3-none

**Title:** BE: N/A — frontend-only ticket
**Parent:** TEN-3
**Contract:** `contracts/tenant/confirm-dialog.contract.md`

**Scope:**

- [ ] No backend work

**Acceptance Criteria:**

- N/A

---

### [TEN-4] — AA Accountant, ISBAT recover gracefully from request failures via a global error boundary

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3aatcv

---

**Scenario:**
API errors currently surface as raw backend messages, and an unexpected render error can blank a page. Outside POS (which has offline handling), network failures have no recovery path. A global error boundary plus a standard error state gives users a readable message and a retry.

**Given:**

- A page throws a render error, or a query fails (network/5xx)

**When:**

- The failure occurs

**Then:**
The system should:

- Catch render errors in a route-level error boundary with a friendly message and Try Again
- Show a standard inline error state (message + Retry) for failed queries instead of raw API text
- Map known error codes to readable copy; log details to console only
- Keep POS offline queueing behavior unchanged

### Sections

- **Error boundary:** per dashboard route group (`error.tsx`)
- **Query error state:** shared component used by tables/forms

### Buttons

- **Try Again**
  - Re-runs the failed query / resets the boundary

---

#### Empty States

- N/A

---

#### Post-Action Behavior

- Successful retry restores the page without a full reload

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-4

**Title:** FE: error.tsx boundaries + shared QueryError component + error-code copy map
**Parent:** TEN-4
**Contract:** `contracts/tenant/error-handling.contract.md`

**Scope:**

- [ ] `error.tsx` in `(dashboard)` route groups with reset support
- [ ] Shared QueryError with retry wired to TanStack Query `refetch`
- [ ] Error-code → user-copy map; fallback generic copy

**Acceptance Criteria:**

- No raw backend error strings rendered to end users

---

### SUBTASK (Backend) — BE-TEN-4-error-codes

**Title:** BE: Consistent error envelope with stable error codes
**Parent:** TEN-4
**Contract:** `contracts/tenant/error-handling.contract.md`

**Scope:**

- [ ] Global exception filter returns `{ error: { code, message } }` consistently
- [ ] Audit top endpoints for ad-hoc error strings and normalize

**Acceptance Criteria:**

- Error responses MUST include a stable machine-readable `code`
