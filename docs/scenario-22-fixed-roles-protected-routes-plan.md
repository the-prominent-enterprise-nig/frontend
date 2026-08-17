# Scenario 22 — Fixed Role Hierarchy, Module Access & Protected Routes — Gap Analysis & Closing Plan

Source: developer-defined, 2026-08-07 — not sourced from either client PDF (unlike Scenarios 01-21). Requested directly as a **counter-check scenario**: a concrete pass/fail test matrix for `rbac-redesign-plan.md`'s security-critical closing items (1, 2, 3, 6, 7) and Scenario 21's blocking prerequisite, plus one requirement not captured anywhere else — protecting the founding Business Owner account from a peer Business Owner.

## Related ClickUp Tickets

None found. Net-new scope — same as Scenario 21.

## Related docs

- `rbac-redesign-plan.md` — the broader RBAC audit and 8-item closing plan this scenario operationalizes into testable steps.
- `scenario-21-role-queues-maker-checker-plan.md` — shares the same blocking prerequisite (the two self-escalation bugs below).

## The scenario we're building toward

1. The role list is fixed: **Business Owner** (global, every branch, every module) and, scoped to a single branch: **Branch Manager**, **Accountant**, **Stock Controller**, **Cashier**.
2. When the business needs a new kind of role (an admin, a support tier, whatever), a Business Owner opens the role builder, names it, and picks exactly which module(s)/permission(s) it gets — nothing more, nothing implied.
3. Every account can act only within its granted module(s) and branch. If an account without a module's permission navigates straight to that module's URL — not just clicks a nav link that happens to be hidden — it lands on a real "you don't have access" page. This holds for the API too: a direct call with that account's token gets rejected, not silently served.
4. A Business Owner can create another Business Owner account.
5. **No account — not even a second Business Owner — can ever delete, deactivate, or strip the role from the founding/primary Business Owner account.**

**Result**: every role's actual access matches exactly what was granted; unauthorized navigation always surfaces a real access-denied state instead of silently succeeding, silently showing nothing, or 500ing; the one account that must never become lockout-able stays protected no matter who else gains Business Owner rights.

## What's already done ✅

1. **Fixed role seed data exists with a real hierarchy concept.** `Role.hierarchyLevel` (Business Owner = 1, Branch Manager/Accountant/Stock Controller = 2) is a real column, and the six roles the business describes are all already seeded (`backend/prisma/seed.ts:2392-2457`), alongside several others (Master Data Approver, Marketing Manager, CRM/sales/procurement roles) from earlier scenarios.
2. **A real custom-role builder exists end-to-end** — create role, name it, assign a specific permission list (`RolesController`, frontend `CreateRoleModal` / `AssignPermissionsModal`). The core mechanism the business wants ("add admin, pick module") already works at the API/data level; it's the UX/structure around it that `rbac-redesign-plan.md` calls "buggy," not its existence.
3. **The enforcement primitive is real, not fake, wherever it's actually applied.** `PermissionsGuard` + `@RequirePermissions(...)`, driven by genuine string-wildcard matching (`permission-check.util.ts`) against a real `Permission` model (`module`/`resource`/`action` columns) — this is a solid foundation, the gap is coverage, not mechanism.
4. **A real "/403" access-denied page and redirect pattern already exist and are proven.** Several pages already do a server-side `can(session, ...)` check before rendering and `redirect('/403')` on failure — e.g. `settings/roles/page.tsx`, `accounting/vendors/page.tsx`. The pattern the business is asking for ("you don't have access") is not a new pattern to invent, just one that needs applying everywhere.
5. **User↔role removal is already permission-gated where it matters most.** `DELETE /users/:id` (deactivate), `DELETE /users/:id/roles/:roleId` (strip a role), and `POST /users/:id/roles` (grant a role) all correctly require `admin:users:update` today (`users.controller.ts:268-380`) — unlike `POST /users` and all of `RolesController` (see gaps below), these three are not wide open to any authenticated user.
6. **Multi-role support exists at the schema level** (`UserRole` join table) — a user, including a Business Owner, can hold more than one role, which "add a role, give them access" depends on structurally.

## What's not done / gaps ❌⚠️

1. **The two live self-escalation bugs undermine everything else in this scenario.** Re-confirmed live on `development` as of 2026-08-07 (`scenario-checklist.md` row 21):
   - `RolesController` has `@RequirePermissions` decorators on every route but **no `PermissionsGuard` applied anywhere** (`roles.controller.ts:24` — only class-level `JwtAuthGuard`). Any authenticated user, including the lowest-tier Cashier, can call `POST /roles/:id/permissions` and grant their own role (or any role) `*:*`.
   - `POST /users` is fully unguarded (`users.controller.ts:140`, only class-level `JwtAuthGuard`) and accepts a caller-supplied `roleIds` array with no entitlement check. Any authenticated user can create a brand-new **Business Owner** account outright.
   - Until these are fixed, "fixed roles with controlled access" isn't a real property of the running system — it's cosmetic. Nothing else in this scenario can be verified as closed while these are open.
2. **No concept of "the founding/primary Business Owner" exists anywhere** — not in the schema, not in `users.service.ts`, not in the frontend. `remove()` (`users.service.ts:582-588`, soft-deactivate via `isActive: false`) and `removeRole()` (`users.service.ts:505-507`, hard-deletes the `UserRole` row) both require only the generic `admin:users:update` permission, with **zero check of who the target is**. A second Business Owner (or any custom role granted just that one permission) can deactivate or de-role the very first Business Owner today. This is the literal bug behind "no one should delete the mostest business owner ever" — it's real, confirmed in current code, not hypothetical.
3. **Protected routes are opt-in per page/controller, not systemic**, on both sides. Backend: per `rbac-redesign-plan.md`'s audit, 14/22 POS controllers, 7/20 Accounting controllers, and 6/7 CRM controllers have zero `PermissionsGuard` reference at all. Frontend: the `can(session, ...)` + `redirect('/403')` pattern only exists on pages where a developer remembered to add it — confirmed present on `settings/roles` and `accounting/vendors`, not verified anywhere else. A user who knows or guesses a URL for a module they don't have can currently reach real data on any unguarded route today, whether they type the URL directly or hit the API with curl/Postman.
4. ~~**Two overlapping "inventory" roles exist in the seed with no documented distinction** — `Stock Controller` (curated permission list, `seed.ts:2424-2432`) and a separately-seeded `Inventory` role (broader `inventory:*` wildcard, `seed.ts:2511-2519`).~~ **Resolved, corrected 2026-08-14**: consolidated to `Stock Controller` alone, granted full `inventory:*` (current `seed.ts:3288-3297`, inline comment: "Scenario 22 Part 9 follow-up: full inventory:\* access, no exceptions... Stock Controller owns its one module completely now"). No separate `Inventory` role remains — this was already reflected in `scenario-checklist.md`'s own Scenario 22 row but never folded back into this plan doc until now.
5. **Branch-scoping for Branch Manager isn't systemic** (carried from `rbac-redesign-plan.md` item 3) — `PermissionsGuard` has no concept of branch at all, so a Branch Manager's granted permissions often resolve enterprise-wide wherever the endpoint doesn't separately implement its own branch filter. This directly contradicts "within branches" from the target model — a Manila Branch Manager can currently read/act on Cebu's records through several confirmed-unscoped endpoints (e.g. `transactions.controller.ts`'s `findOne`/`addPayment`/`getCustomerHistory` take no branch parameter at all).
6. **Role names aren't protected from rename or deletion server-side.** 15+ locations hardcode `'Business Owner'`/`'Branch Manager'` string checks (two of them entire duplicated frontend access-logic files). `PROTECTED_ROLE_NAMES` in `RolesSection.tsx` is a **frontend-only, UI-level** safeguard — if the `Business Owner` role is ever renamed via the currently-unrestricted role-edit endpoint, every hardcoded check silently breaks and the UI stops recognizing it as protected too.
7. **Deactivating a role has no runtime effect on users who already hold it** (`Role.isActive` never checked at the point of enforcement — `rbac-redesign-plan.md` item 2). Relevant here because "fixed roles, only deactivatable, not deletable" implicitly assumes deactivation actually revokes access — today it doesn't. A correct version of this check already exists in dead code (`CurrentUserGuard`, never wired into the live guard chain).

## Closing the gaps

Ordered by risk/value — items 1-2 are hard gates; nothing else here is meaningfully verifiable until they land.

### 1. Fix the two self-escalation bugs

**Fix**: add `@UseGuards(PermissionsGuard)` (class-level) to `RolesController`, matching the working pattern already used correctly on `PermissionsController`; add the same guard plus `@RequirePermissions('admin:users:create')` to `UsersController.create()`. Same fix as `rbac-redesign-plan.md` item 1 / Scenario 21's blocking prerequisite — not duplicated work, just the hard gate for this scenario specifically.

### 2. Protect the founding Business Owner account

**Needs an explicit design decision first** (see Open Questions below), then: add whichever marker is chosen, and add a check in `remove()`, `removeRole()`, and `setActiveStatus()` (`users.service.ts`) that throws `ForbiddenException` when the target user is the protected founder — regardless of the caller's own role or permissions. Also confirm there's no side door: stripping the `Business Owner` role's own permissions down to nothing, or deleting the role definition itself, would neuter the founder just as effectively as deactivating their user — decide whether that needs blocking too (Open Question 2).

### 3. Make protected-route enforcement systemic, not opt-in

- **Backend**: same direction as `rbac-redesign-plan.md` item 3 — a global guard or a controller-level default, rather than relying on every controller remembering `@UseGuards(PermissionsGuard)` individually.
- **Frontend**: sweep every page under `(dashboard)` for the `can(session, ...)` + `redirect('/403')` guard; add it wherever missing. Also close the known sidebar/permission mismatch (Branch Manager's nav bypasses module-level checks entirely per `[[project_branch_manager_full_access]]`-class findings) so a visible-but-ungranted link is never live underneath — a hidden link and a real 403 should agree.

### 4. ~~Reconcile `Stock Controller` vs `Inventory`~~ — resolved 2026-08-14, see Gap 4 above.

### 5. Protect system role names from rename/delete, server-side

**Fix**: reject a rename or delete of the seeded system role names (`Business Owner`, `Branch Manager`, `Accountant`, `Stock Controller`, `Cashier`, etc.) at the API level, not just via `RolesSection.tsx`'s UI-only `PROTECTED_ROLE_NAMES` set. A stopgap for gap 6 — doesn't require the full hardcoded-check-elimination sweep from `rbac-redesign-plan.md` item 7 to land first.

### 6. Make `Role.isActive` real at enforcement time

**Fix**: add the `ur.role.isActive` filter into `PermissionsGuard`'s and `permission-check.util.ts`'s permission-flattening logic, matching what the dead `CurrentUserGuard` already does correctly — then either wire that guard in properly or delete it. A direct dependency of this scenario's "give/remove access" story: deactivating a role should actually revoke access for everyone still holding it.

## Open questions requiring developer/business confirmation

1. **How do we identify "the mostest Business Owner"?** No such concept exists today. Options: **(a)** earliest-`createdAt` User row holding the Business Owner role per `enterpriseOwnerId` — fragile, since seed order, a future data migration, or a manual fix could shift "earliest" silently; **(b)** an explicit boolean flag (e.g. `User.isFounder`) set once at account/tenant creation and never re-assignable through any API — more robust, **recommended**; **(c)** tie it to `EnterpriseOwner` itself — doesn't map cleanly today, since `EnterpriseOwner` is the tenant record, not a user, with no existing 1:1 link to a specific owner account.
2. **What exactly counts as "protected"?** Just un-deactivatable and un-role-strippable, or also: immune to having its own permissions edited down, and excluded entirely as a valid target for `admin:users:update` actions by anyone but itself? Separately: the request says "delete," but `remove()` is actually a soft-deactivate — no endpoint hard-deletes a `User` row today. Worth confirming deactivation/de-roling is the real concern (it is, functionally) rather than literal row deletion.
3. **Can the founding Business Owner act on themselves** — step down, transfer "founder" status to someone else, or deactivate their own account voluntarily? Worth deciding explicitly; a self-service exit path may still be wanted even though a peer-initiated one must be blocked.
4. ~~**`Stock Controller` vs `Inventory`**~~ — resolved 2026-08-14, see Gap 4 above.
5. **Does "add admin, pick module" mean whole-module-level toggles, or does today's fine-grained 261-permission builder stay as-is alongside it?** The request's phrasing ("select what role or module they can do") suggests a simpler module-level grant might be wanted in addition to — or instead of — the current flat permission list. `rbac-redesign-plan.md`'s own custom-role-builder redesign (module taxonomy, level-cards, presets) is a large adjacent piece of already-planned work; worth confirming scope overlap before closing gap 3 above so it isn't built twice.

## Verification — the counter-check test matrix

This is the actual "counter check": concrete pass/fail steps per role, to run after each closing-gap item above lands. Current (2026-08-07) expected result noted for each, based on already-confirmed code.

### Per-role module access (repeat for Business Owner, Branch Manager, Accountant, Stock Controller, Cashier, and one freshly-built custom role)

- Navigate directly (typed URL, not a nav click) to a page inside a module the role **does** have → page renders normally.
- Navigate directly to a page inside a module the role **does not** have → real "you don't have access" page, both on first server-render and on client-side navigation. **Currently: FAIL on any route whose controller/page has no guard (see gap 3) — silently reachable today.**
- Call the underlying API route directly (e.g. curl with that user's token) for a module the role doesn't have → `403`, not a silent `200` with empty/filtered data, not a `500`. **Currently: FAIL on the 14/22 POS + 7/20 Accounting + 6/7 CRM unguarded controllers.**
- For a write action (create/update/delete) inside a module where the role only has `:read` → `403` on the write call specifically, even though the read succeeds. **Untested at scale — spot-check per module once gap 3 lands.**

### Branch scoping (Branch Manager and any branch-scoped custom role)

- Fetch a record by ID that belongs to a **different** branch (one representative endpoint per module: POS transaction, accounting journal entry, inventory stock balance, CRM customer once branch-scoped) → `403`/`404`, not the record. **Currently: FAIL for confirmed examples** (`transactions.controller.ts`'s `findOne`/`addPayment`/`getCustomerHistory` take no branch parameter at all).
- List endpoints (e.g. transaction list, customer list) return only the caller's own branch's rows, never another branch's, even when no explicit branch filter is passed in the query. **Currently: passes only where a per-endpoint convention was manually added (a documented minority).**

### Self-escalation (the two hard-gate bugs)

- A Cashier calls `POST /roles/:id/permissions` on their own Cashier role, adding `*:*` → must `403`. **Currently: FAIL — succeeds.**
- A Cashier calls `POST /users` with `roleIds: [<Business Owner role id>]` → must `403`. **Currently: FAIL — succeeds, creates a live Business Owner.**

### Founding Business Owner protection

- A second Business Owner calls `DELETE /users/:id` targeting the founding Business Owner → must be blocked. **Currently: FAIL — no check exists, succeeds.**
- A second Business Owner calls `DELETE /users/:id/roles/:roleId` removing the founder's `Business Owner` `UserRole` → must be blocked (same effective outcome as deletion via a different endpoint — confirm it isn't a side door). **Currently: FAIL — no check exists, succeeds.**
- A second Business Owner calls `PATCH /users/:id/status` deactivating the founder → must be blocked. **Currently: FAIL — no check exists, succeeds.**
- A second Business Owner (or any role holding `admin:roles:update`) edits the `Business Owner` role's own permission list, stripping it down → per Open Question 2, decide whether this needs blocking too, since it would functionally neuter every Business Owner including the founder without touching the founder's `User`/`UserRole` rows at all.
- The founding Business Owner creates a second Business Owner account → must succeed. **This direction stays open — only the reverse is blocked.**
- The founding Business Owner deactivates or de-roles a **non-founding** Business Owner → must succeed. **Protection is specific to the founder, not the tier.**

### Custom role builder

- Build a role granted only `inventory:*:read` → holder can view inventory pages, gets `/403` on every other module's URL, and gets `403` on any inventory write endpoint despite read access working. Confirms the builder's grant matches actual runtime access, not just what the UI implies.

## Dead code / unused-feature flags

- **`CurrentUserGuard`** (`auth/gaurds/current-user.gaurd.ts`) — has the correct `isActive`-role-filter logic needed for Closing Gap 6, but is never applied anywhere. Fold its logic into the live `PermissionsGuard`, then delete it, rather than leaving a second unused implementation to drift further (same recommendation as `rbac-redesign-plan.md` item 8).
