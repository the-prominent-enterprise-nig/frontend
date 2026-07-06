---
list: '06 - Point of Sale (POS)'
list_id: '901615166757'
last_synced: '2026-06-10'
---

# Point of Sale Tickets

## Summary

| ID     | Title                                                                                                         | Status | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| POS-55 | AA Cashier, ISBAT complete a sale using only the keyboard and barcode scanner                                 | TO DO  | high     |
| POS-56 | AA Manager, ISBAT paginate, sort, and filter the POS transactions table                                       | TO DO  | normal   |
| POS-57 | AA Business Owner, ISBAT manage POS PIN and payment method settings from a centralized configuration page     | for QA | normal   |
| POS-58 | AA Employee, ISBAT access profile, settings, and account actions from a single dropdown in the top navigation | for QA | low      |

---

## Tickets

### [POS-55] — AA Cashier, ISBAT complete a sale using only the keyboard and barcode scanner

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aatdn

---

**Scenario:**
Checkout is the highest-frequency screen in the system. Cashiers should never need the mouse for a standard sale: scan (or type) a barcode, adjust quantity, choose payment, and confirm — all via keyboard. The search field already accepts barcode input; this ticket adds the shortcut layer and quantity entry.

**Given:**

- An open POS session on a terminal
- The checkout page is loaded with the search field focused

**When:**

- The cashier scans items and uses keyboard shortcuts through payment

**Then:**
The system should:

- Keep the scan/search field auto-focused after each add (focus returns after any action)
- Support shortcuts: `F2` focus search, `+`/`-` adjust qty of last-added line, `F4` quantity entry for selected line, `F8` open payment, `F9` cash exact, `Esc` cancel dialog, `Enter` confirm
- Show a discoverable shortcut legend (`?` opens cheat-sheet overlay)
- Navigate cart lines with arrow keys; `Delete` removes the selected line (with confirm)
- Complete payment and start the next sale without any mouse interaction

### Sections

- **Shortcut legend overlay:** grouped by stage (cart, payment)

### Buttons

- All existing buttons remain; shortcuts are additive, shown as hints on buttons

---

#### Empty States

- Empty cart: shortcuts inactive except search focus

---

#### Post-Action Behavior

- After completed sale, focus returns to scan field for the next customer

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-POS-55

**Title:** FE: Keyboard shortcut layer + focus management on checkout
**Parent:** POS-55
**Contract:** `contracts/pos/keyboard-checkout.contract.md`

**Scope:**

- [ ] Global key handler scoped to checkout page (disabled while dialogs capture input)
- [ ] Focus-return logic after add/qty/payment actions
- [ ] Shortcut legend overlay (`?`)
- [ ] Cart line selection model (arrow keys, Delete)

**Acceptance Criteria:**

- A standard cash sale MUST be completable with zero mouse interaction
- Shortcuts MUST NOT fire while typing in text inputs other than the scan field

---

### SUBTASK (Backend) — BE-POS-55-none

**Title:** BE: N/A — frontend-only ticket
**Parent:** POS-55
**Contract:** `contracts/pos/keyboard-checkout.contract.md`

**Scope:**

- [ ] No backend work; existing transaction endpoints unchanged

**Acceptance Criteria:**

- N/A

---

### [POS-56] — AA Manager, ISBAT paginate, sort, and filter the POS transactions table

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3aated

---

**Scenario:**
The POS transactions list loads all rows at once with filters but no pagination or column sorting. With daily branch volume this will degrade fast. The table should paginate server-side and sort by date, amount, type, and status, keeping existing filters.

**Given:**

- More transactions exist than one page size
- The user has `pos:transactions:read` permission

**When:**

- The user opens POS → Transactions, changes pages, or clicks a column header

**Then:**
The system should:

- Fetch pages server-side (`page`, `pageSize`, default 25)
- Sort asc/desc by date, transaction number, amount, type, status
- Preserve filters + sort + page in the URL (shareable)
- Show total count and page controls

### Table

- **Columns:** txn #, date/time, type, cashier, terminal, amount, status

### Buttons

- **Page controls:** first/prev/next/last; disabled at bounds

---

#### Empty States

- Existing empty/"no results" states preserved

---

#### Post-Action Behavior

- Page changes do not reset filters; active sort indicated on header

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-POS-56

**Title:** FE: Server-side pagination + sorting on transactions table
**Parent:** POS-56
**Contract:** `contracts/pos/transactions-list.contract.md`

**Scope:**

- [ ] URL-synced page/sort state (nuqs)
- [ ] Sortable headers with indicators
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Pagination state MUST survive refresh via URL

---

### SUBTASK (Backend) — BE-POS-56-txn-pagination

**Title:** BE: GET /pos/transactions — add page/pageSize/sort params
**Parent:** POS-56
**Contract:** `contracts/pos/transactions-list.contract.md`

**Scope:**

- [ ] `GET /pos/transactions?page&pageSize&sortBy&sortDir&type&status&from&to` — returns `{ data, meta: { total, page, pageSize } }`
- [ ] Validation: pageSize ≤ 100, sortBy whitelist
- [ ] Error responses: `VALIDATION_ERROR`
- [ ] Auth: bearer token + `pos:transactions:read`

**Acceptance Criteria:**

- `meta.total` MUST reflect the filtered count

---

### [POS-57] — AA Business Owner, ISBAT manage POS PIN and payment method settings from a centralized configuration page

**Status:** for QA
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3huchn

---

**Scenario:**
Business Owners and Branch Managers need a single place to configure PIN access and payment method availability without jumping between pages. The `/settings/configuration` page provides a tabbed view: one tab for the Cashier PIN lifecycle (set / view / change / reset), and one tab for globally enabling or disabling payment methods. POS Managers have read/change access to the PIN tab only.

**Given:**

- The user is logged in as Business Owner, Branch Manager, or POS Manager
- The `/settings/configuration` route is accessible from the "Configuration" sidebar entry

**When:**

- The user opens `/settings/configuration`

**Then:**
The system should:

- Display two tabs: **POS PIN** and **Payment Methods**
- On the POS PIN tab, show the correct mode based on whether a PIN has been set:
  - **Set mode** — first-time setup form (PIN + confirm)
  - **View mode** — masked display (`● ● ● ● ●`) with Change and Reset buttons
  - **Change mode** — current PIN + new PIN + confirm fields; "Forgot PIN?" link switches to Reset
  - **Reset mode** — amber warning card with confirmation, calls the register endpoint (idempotent)
- On the Payment Methods tab, show owner-level enable/disable toggles for each method; disabled methods are off globally for all branches
- Restrict access: cashiers and other roles see a permission error or are redirected

### Tabs

- **POS PIN** — PIN lifecycle management; right column shows contextual hint text per mode
- **Payment Methods** — global enable/disable toggles; edit mode saves in bulk

### Buttons

- **Change PIN** — switches from View → Change mode
- **Forgot PIN? / Reset PIN** — switches to Reset mode; on confirm calls register endpoint
- **Save** (Payment Methods) — saves bulk toggle state
- **Cancel** — reverts edits without saving

---

#### Empty States

- Payment Methods tab: if no methods configured, shows "No payment methods configured."

---

#### Post-Action Behavior

- After PIN set/change: mode switches to View with success toast
- After PIN reset: mode switches to View with success toast
- After saving payment methods: toggles reflect new state; success toast shown

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-POS-57

**Title:** FE: /settings/configuration page — PIN lifecycle tabs + payment method toggles
**Parent:** POS-57
**Contract:** `contracts/pos/configuration.contract.md`

**Scope:**

- [x] `ConfigurationTabs` client component with `pin | payment` tab state
- [x] `PinSection` with 4-mode state machine (set / view / change / reset)
- [x] `OwnerPaymentMethodsSection` with bulk enable/disable toggles
- [x] `getCashierPinStatus` server action (`GET /pos/cashier/pin/status`)
- [x] `canAccess()` guard — allows isAdmin, Branch Manager, pos-manager
- [x] Sidebar entry renamed from "Payment Config" → "Configuration"
- [x] Handle loading/error states per tab

**Acceptance Criteria:**

- PIN mode MUST be derived from `hasPin` returned by the status endpoint
- Payment Methods MUST reflect owner-level toggle state
- Cashiers and unauthorized roles MUST NOT access this page

---

### SUBTASK (Backend) — BE-POS-57-pin-status

**Title:** BE: GET /pos/cashier/pin/status — return whether authenticated user has a PIN set
**Parent:** POS-57
**Contract:** `contracts/pos/configuration.contract.md`

**Scope:**

- [x] Implement `GET /pos/cashier/pin/status` — reads `cashierPin` field on `User`, returns `{ hasPin: boolean }`
- [x] Auth: bearer token (JwtAuthGuard)
- [x] Response shape: `{ hasPin: boolean }`
- [x] Error: `404` if user not found

**Acceptance Criteria:**

- Returns `{ hasPin: false }` when `cashierPin` is null
- Returns `{ hasPin: true }` when `cashierPin` is set

---

### [POS-58] — AA Employee, ISBAT access profile, settings, and account actions from a single dropdown in the top navigation

**Status:** for QA
**Priority:** low
**ClickUp:** https://app.clickup.com/t/86d3hudcw

---

**Scenario:**
The top navigation previously had two separate entry points: a gear icon for admin settings and an avatar dropdown for profile actions. This created unnecessary clutter and an inconsistent UX. The gear icon is removed entirely; the avatar dropdown is extended to include View Profile, Change Password, Admin Settings (Users / Roles / Permissions — shown only for eligible roles), and Logout. The "My Profile" sidebar entry is also removed from all role configs since the profile is now reachable from the dropdown.

**Given:**

- Any authenticated user is logged in
- The top navigation bar is visible

**When:**

- The user clicks their avatar in the top-right corner

**Then:**
The system should:

- Show a dropdown with: name + email header, View Profile, Change Password
- For users with `admin:roles:manage` permission (excluding Business Owner): show an "Admin Settings" section with links to Users, Roles, Permissions
- Show a Logout button at the bottom, separated by a divider
- Close the dropdown when clicking outside or after navigating
- NOT show a gear icon anywhere in the top navigation
- NOT show "My Profile" in the sidebar for any role

### Dropdown Sections

- **Header** — display name + email (read-only)
- **Profile** — View Profile, Change Password
- **Admin Settings** _(conditional)_ — Users, Roles, Permissions links with active-state highlight
- **Account** — Logout (red)

### Buttons

- **View Profile** — navigates to `/workspace/profile`
- **Change Password** — opens Change Password modal inline
- **Users / Roles / Permissions** — navigate to respective settings pages; highlighted when active
- **Logout** — calls logout action and redirects to login

---

#### Empty States

- N/A — dropdown always has at least the header + profile actions + logout

---

#### Post-Action Behavior

- After clicking a nav link: dropdown closes, user is navigated to target page
- After logout: redirected to login page

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-POS-58

**Title:** FE: Consolidate gear icon + profile actions into single avatar dropdown; remove "My Profile" from sidebar
**Parent:** POS-58

**Scope:**

- [x] Remove gear icon button and its settings dropdown from `TopBar.tsx`
- [x] Move Admin Settings links (Users, Roles, Permissions) into profile avatar dropdown
- [x] Move Logout button into profile avatar dropdown
- [x] Remove `settingsOpen` state and related logic
- [x] Remove "My Profile" from `MY_WORKSPACE_ITEMS`, `OWNER_WORKSPACE_ITEMS`, `branchManagerWorkspaceItems`, and `navItemsBySegment['Business Owner']` in `SideBar.tsx`

**Acceptance Criteria:**

- Gear icon MUST NOT appear in the top nav for any role
- Admin Settings section MUST only appear for users with `admin:roles:manage` and primaryRole !== 'Business Owner'
- "My Profile" MUST NOT appear in the sidebar for any role
- Logout MUST be reachable from the avatar dropdown
