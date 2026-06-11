---
list: '01 - Business & Tenant (TEN)'
list_id: '901615166750'
last_synced: '2026-06-10'
---

# Business & Tenant Tickets

## Summary

| ID     | Title                                                                                     | Status | Priority |
| ------ | ----------------------------------------------------------------------------------------- | ------ | -------- |
| TEN-26 | AA Employee, ISBAT see only enabled modules and finished pages in the navigation          | TO DO  | high     |
| TEN-27 | AA Inventory Manager, ISBAT navigate with breadcrumbs on all nested pages                 | TO DO  | normal   |
| TEN-28 | AA Cashier, ISBAT rely on consistent, focus-trapped confirmation dialogs                  | TO DO  | normal   |
| TEN-29 | AA Accountant, ISBAT recover gracefully from request failures via a global error boundary | TO DO  | normal   |
| TEN-30 | AA Business Owner, ISBAT add a user account with role and branch assignment               | for QA | high     |
| TEN-31 | AA Business Owner, ISBAT edit a user's details and deactivate or reactivate them          | for QA | high     |
| TEN-32 | AA Business Owner, ISBAT reset a user's password                                          | for QA | high     |
| TEN-33 | AA Business Owner, ISBAT assign a user to one or more branches                            | for QA | high     |
| TEN-38 | AA Business Owner, ISBAT see a list of users                                              | for QA | normal   |
| TEN-39 | AA Business Owner, ISBAT view a user's details                                            | for QA | normal   |

---

## Tickets

### [TEN-26] — AA Employee, ISBAT see only enabled modules and finished pages in the navigation

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

### SUBTASK (Frontend) — FE-TEN-26

**Title:** FE: Module-config-driven sidebar + placeholder route removal
**Parent:** TEN-26
**Contract:** `contracts/tenant/module-navigation.contract.md`

**Scope:**

- [ ] Nav config consumes tenant enabled-modules from session/enterprise payload
- [ ] Remove or guard ComingSoon routes (`/workspace/*`, `/settings/system`, `/settings/export`)
- [ ] Layout-level guard returns 404/403 for disabled module routes
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- No placeholder page reachable via nav or direct URL for NIG tenant config

---

### SUBTASK (Backend) — BE-TEN-26-modules

**Title:** BE: Expose enabled modules in session/enterprise payload
**Parent:** TEN-26
**Contract:** `contracts/tenant/module-navigation.contract.md`

**Scope:**

- [ ] Session/enterprise endpoint returns `enabledModules: string[]`
- [ ] Module guard rejects API calls to disabled modules with `MODULE_DISABLED`
- [ ] Auth: bearer token

**Acceptance Criteria:**

- Module list MUST come from the enterprise module assignment, not constants

---

### [TEN-27] — AA Inventory Manager, ISBAT navigate with breadcrumbs on all nested pages

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

### SUBTASK (Frontend) — FE-TEN-27

**Title:** FE: Route-derived breadcrumb component in dashboard layout
**Parent:** TEN-27
**Contract:** `contracts/tenant/breadcrumbs.contract.md`

**Scope:**

- [ ] Breadcrumb component mapping route segments to labels
- [ ] Entity-name resolution hook for dynamic segments
- [ ] Render in `(dashboard)` layout once, all pages inherit

**Acceptance Criteria:**

- Every dashboard route 2+ levels deep MUST show a correct trail

---

### SUBTASK (Backend) — BE-TEN-27-none

**Title:** BE: N/A — frontend-only ticket
**Parent:** TEN-27
**Contract:** `contracts/tenant/breadcrumbs.contract.md`

**Scope:**

- [ ] No backend work; existing detail endpoints provide entity names

**Acceptance Criteria:**

- N/A

---

### [TEN-28] — AA Cashier, ISBAT rely on consistent, focus-trapped confirmation dialogs

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

### SUBTASK (Frontend) — FE-TEN-28

**Title:** FE: Shared ConfirmDialog (Radix) + migrate destructive actions
**Parent:** TEN-28
**Contract:** `contracts/tenant/confirm-dialog.contract.md`

**Scope:**

- [ ] Build shared dialog on Radix Dialog primitives (focus trap built in)
- [ ] Migrate void transaction, delete user/role, archive customer, close session dialogs
- [ ] Audit remaining destructive actions and migrate

**Acceptance Criteria:**

- Tab/Shift-Tab MUST stay within an open dialog; Esc closes; trigger refocused on close

---

### SUBTASK (Backend) — BE-TEN-28-none

**Title:** BE: N/A — frontend-only ticket
**Parent:** TEN-28
**Contract:** `contracts/tenant/confirm-dialog.contract.md`

**Scope:**

- [ ] No backend work

**Acceptance Criteria:**

- N/A

---

### [TEN-29] — AA Accountant, ISBAT recover gracefully from request failures via a global error boundary

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

### SUBTASK (Frontend) — FE-TEN-29

**Title:** FE: error.tsx boundaries + shared QueryError component + error-code copy map
**Parent:** TEN-29
**Contract:** `contracts/tenant/error-handling.contract.md`

**Scope:**

- [ ] `error.tsx` in `(dashboard)` route groups with reset support
- [ ] Shared QueryError with retry wired to TanStack Query `refetch`
- [ ] Error-code → user-copy map; fallback generic copy

**Acceptance Criteria:**

- No raw backend error strings rendered to end users

---

### SUBTASK (Backend) — BE-TEN-29-error-codes

**Title:** BE: Consistent error envelope with stable error codes
**Parent:** TEN-29
**Contract:** `contracts/tenant/error-handling.contract.md`

**Scope:**

- [ ] Global exception filter returns `{ error: { code, message } }` consistently
- [ ] Audit top endpoints for ad-hoc error strings and normalize

**Acceptance Criteria:**

- Error responses MUST include a stable machine-readable `code`

---

### [TEN-30] — AA Business Owner, ISBAT add a user account with role and branch assignment

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aarrf

---

**Scenario:**
The business owner (or admin with user-management permission) creates accounts for employees so they can log in with the right role and branch from day one. Charter shared capability: "User account management".

**Given:**

- The user is authenticated with `admin:users:create` permission
- At least one role and one branch exist

**When:**

- The user opens Settings → Users → Add User and submits the form

**Then:**
The system should:

- Create the account with name, email, role(s), and branch assignment
- Set initial status (PENDING_SETUP until first login / ACTIVE if password set directly)
- Reject duplicate emails with a clear inline error
- Show the new user in the users list immediately

### Fields

- **Name:** required
- **Email:** required, valid format, unique per tenant
- **Role(s):** at least one required
- **Branch(es):** at least one required for branch-scoped roles
- **Initial password / invite:** per tenant flow

### Buttons

- **Add User**
  - Disabled while invalid or submitting

---

#### Empty States

- Users list with only the owner shows "Add your first team member"

---

#### Post-Action Behavior

- Success toast; list refreshes; user receives credentials/invite per flow

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-30

**Title:** FE: Add-user form on Settings → Users
**Parent:** TEN-30
**Contract:** `contracts/tenant/users-create.contract.md`

**Scope:**

- [ ] Types match `/users` create response shape
- [ ] Role + branch pickers with validation
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Duplicate email error MUST render inline on the email field

---

### SUBTASK (Backend) — BE-TEN-30-users-create

**Title:** BE: POST /users — create account with roles + branches
**Parent:** TEN-30
**Contract:** `contracts/tenant/users-create.contract.md`

**Scope:**

- [ ] `POST /users` — creates user, assigns roles/branches, returns `{ data, meta }`
- [ ] Validation: email unique per tenant, role/branch existence
- [ ] Error responses: `DUPLICATE_EMAIL`, `ROLE_NOT_FOUND`, `BRANCH_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `admin:users:create`

**Acceptance Criteria:**

- User, role links, and branch links MUST be created transactionally

---

### [TEN-31] — AA Business Owner, ISBAT edit a user's details and deactivate or reactivate them

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aart0

---

**Scenario:**
When staff change positions or leave, the owner updates their details or deactivates the account. Deactivated users cannot log in but their historical records (sales, JEs, audit entries) remain attributed.

**Given:**

- An existing user account
- The actor has `admin:users:update` permission

**When:**

- The actor edits details or toggles active status from the user's row/detail

**Then:**
The system should:

- Save name/email/role changes with validation
- Deactivate: block login immediately, keep history attributed; show INACTIVE badge
- Reactivate: restore login without re-creating the account
- Prevent the owner from deactivating their own account

### Fields

- **Name / Email / Roles:** editable per create rules
- **Status:** ACTIVE | INACTIVE | SUSPENDED

### Buttons

- **Save Changes** / **Deactivate** (confirmation dialog) / **Reactivate**

---

#### Empty States

- N/A (action on existing record)

---

#### Post-Action Behavior

- Status badge updates in place; deactivated user sessions invalidated

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-31

**Title:** FE: Edit-user form + deactivate/reactivate actions
**Parent:** TEN-31
**Contract:** `contracts/tenant/users-update.contract.md`

**Scope:**

- [ ] Types match `/users/:id` update response shape
- [ ] Confirmation dialog for deactivation
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Self-deactivation MUST be blocked client-side and server-side

---

### SUBTASK (Backend) — BE-TEN-31-users-update

**Title:** BE: PATCH /users/:id + status actions
**Parent:** TEN-31
**Contract:** `contracts/tenant/users-update.contract.md`

**Scope:**

- [ ] `PATCH /users/:id` and status transitions — returns `{ data, meta }`
- [ ] Deactivation invalidates active sessions/tokens
- [ ] Error responses: `USER_NOT_FOUND`, `CANNOT_DEACTIVATE_SELF`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `admin:users:update`

**Acceptance Criteria:**

- Historical records MUST stay attributed to deactivated users

---

### [TEN-32] — AA Business Owner, ISBAT reset a user's password

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aartm

---

**Scenario:**
When an employee is locked out, the owner triggers a password reset from the user list so the employee can regain access without support intervention.

**Given:**

- An active user account
- The actor has `admin:users:update` permission

**When:**

- The actor clicks Reset Password on the user row and confirms

**Then:**
The system should:

- Issue a reset (temporary password or reset link per tenant flow)
- Force password change on next login when a temporary password is used
- Log the reset in the audit trail (who reset whom, when)
- Never display the old password (irrecoverable)

### Buttons

- **Reset Password**
  - Confirmation dialog stating the consequence

---

#### Empty States

- N/A

---

#### Post-Action Behavior

- Success toast with delivery confirmation (email sent / temp password shown once)

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-32

**Title:** FE: Reset-password action with confirm + one-time display
**Parent:** TEN-32
**Contract:** `contracts/tenant/password-reset.contract.md`

**Scope:**

- [ ] Confirmation dialog; one-time temp-password display where applicable
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Temp password MUST never be re-fetchable after dismissal

---

### SUBTASK (Backend) — BE-TEN-32-password-reset

**Title:** BE: POST /users/:id/reset-password
**Parent:** TEN-32
**Contract:** `contracts/tenant/password-reset.contract.md`

**Scope:**

- [ ] `POST /users/:id/reset-password` — returns `{ data, meta }`
- [ ] Force-change flag on next login; audit log entry written
- [ ] Error responses: `USER_NOT_FOUND`, `USER_INACTIVE`
- [ ] Auth: bearer token + `admin:users:update`

**Acceptance Criteria:**

- Reset MUST be recorded in the audit trail with actor identity

---

### [TEN-33] — AA Business Owner, ISBAT assign a user to one or more branches

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aaru2

---

**Scenario:**
Charter shared capability: "Branch access management". Staff who cover multiple locations need access to more than one branch; the owner manages each user's branch list, which drives RBAC-01 scoping on login.

**Given:**

- A user and at least one branch exist
- The actor has `admin:users:update` permission

**When:**

- The actor edits the user's branch assignments

**Then:**
The system should:

- Save the user-branch set (add/remove) via the UserBranch association
- Apply the new scope on the user's next login (or token refresh)
- Require at least one branch for branch-scoped roles; head-office roles may have none
- Show assigned branches as chips on the user row/detail

### Fields

- **Branches:** multi-select of active branches

### Buttons

- **Save Assignments**

---

#### Empty States

- Head-office users show "All branches (head scope)"

---

#### Post-Action Behavior

- Updated branch chips render; change visible in audit log

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-33

**Title:** FE: Branch assignment multi-select on user detail
**Parent:** TEN-33
**Contract:** `contracts/tenant/user-branches.contract.md`

**Scope:**

- [ ] Types match `/users/:id/branches` response shape
- [ ] Multi-select with chips; validation per role scope
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-TEN-33-user-branches

**Title:** BE: PUT /users/:id/branches — replace branch assignment set
**Parent:** TEN-33
**Contract:** `contracts/tenant/user-branches.contract.md`

**Scope:**

- [ ] `PUT /users/:id/branches` — replaces UserBranch set, returns `{ data, meta }`
- [ ] Validation: branches exist and are active; min-one rule per role scope
- [ ] Error responses: `USER_NOT_FOUND`, `BRANCH_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `admin:users:update`

**Acceptance Criteria:**

- New scope MUST be reflected in the next issued JWT

---

### [TEN-38] — AA Business Owner, ISBAT see a list of users

**Status:** for QA
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3abbq5

---

**Scenario:**
The Business Owner or Admin needs to see all user accounts in the system to manage their workforce.

**Given:**

- The actor is authenticated with `admin:users:read` permission

**When:**

- The actor opens Settings → Users

**Then:**
The system should:

- List all users with name, email, role(s), branch(es), and status
- Support search by name or email
- Show active/inactive status indicator per row

### Sections

- **Users table:** name, email, role chips, branch(es), status, actions

---

#### Empty States

- "No users yet" with a Create User button

---

#### Post-Action Behavior

- Table reflects live status changes without full reload

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-38

**Title:** FE: Users list table on Settings → Users
**Parent:** TEN-38
**Contract:** `contracts/tenant/users-list.contract.md`

**Scope:**

- [ ] Types match `/users` response shapes
- [ ] Table with search, status filter, role/branch chips
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-TEN-38

**Title:** BE: N/A — GET /users already implemented
**Parent:** TEN-38
**Contract:** `contracts/tenant/users-list.contract.md`

**Scope:**

- [ ] No backend work; endpoint exists and is functional

**Acceptance Criteria:**

- N/A

---

### [TEN-39] — AA Business Owner, ISBAT view a user's details

**Status:** for QA
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3abbub

---

**Scenario:**
The Business Owner or Admin needs to see the full details of a specific user — their roles, branches, and account status — before taking any action on the account.

**Given:**

- The actor is authenticated with `admin:users:read` permission
- At least one user exists

**When:**

- The actor clicks a user row in the Users list

**Then:**
The system should:

- Open a side drawer with the user's full name, email, status, assigned roles (with chips), and assigned branches
- Allow navigating to edit or status actions directly from the drawer

### Sections

- **User detail drawer:** profile info, roles, branches, actions bar

---

#### Empty States

- N/A (drawer only opens for existing users)

---

#### Post-Action Behavior

- Drawer updates to reflect role/branch/status changes made from within

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-TEN-39

**Title:** FE: User detail side drawer on Settings → Users
**Parent:** TEN-39
**Contract:** `contracts/tenant/user-detail.contract.md`

**Scope:**

- [ ] Types match `/users/:id` response shapes
- [ ] Side drawer with roles, branches, and action buttons
- [ ] Handle all error codes from the contract
- [ ] Loading states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-TEN-39

**Title:** BE: N/A — GET /users/:id already implemented
**Parent:** TEN-39
**Contract:** `contracts/tenant/user-detail.contract.md`

**Scope:**

- [ ] No backend work; endpoint exists and is functional

**Acceptance Criteria:**

- N/A
