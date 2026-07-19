# RBAC Redesign — Current State, Security Findings & Closing Plan

## Context

The business reports current role/permission access as "very buggy." The target model is:

- **Business Owner** — access to everything, every branch, every module.
- **Branch Manager** — access to everything, but scoped to their own assigned branch only.
- **Employee-level roles** (Cashier, Stock Controller, etc.) — access only to the module(s) they're assigned, and only within their own branch.

There's also a custom-role-builder feature (Business Owner creates a role, names it, assigns permissions) that the business describes as "buggy" and "all over the place," suspecting it lacks structure/limits.

This doc was produced by two parallel research passes over the live codebase (backend: `/Users/chloe/Documents/tpe-nig/backend`, frontend: `/Users/chloe/Documents/tpe-nig/frontend`) — one on the core data model/enforcement/branch-scoping, one on the custom role builder UI and the specific user-management flows already marked "failed qa" in the ClickUp backlog. Every claim below is file:line-cited from that research.

## ⚠️ Fix immediately, before anything else in this plan

Two findings are not "buggy UX" — they're live privilege-escalation paths in a system already handling real access control:

1. **`RolesController` has no `PermissionsGuard`.** Every route declares `@RequirePermissions('admin:roles:...')`, but that decorator does nothing without `PermissionsGuard` also applied — and it's never applied to this controller (only the class-level `JwtAuthGuard`, `backend/src/roles/roles.controller.ts:24`). **Any authenticated user, regardless of role, can call `POST /roles/:id/permissions` and grant any role — including their own Cashier role — every permission in the system, including `*:*` wildcards.**
2. **`POST /users` has no `PermissionsGuard` either** (`backend/src/users/users.controller.ts:43,140-165`) — the class comment literally says `// ← Protect all routes` next to `@UseGuards(JwtAuthGuard)`, treating authentication as sufficient. `CreateUserDto.roleIds` is caller-supplied with no check that the caller is entitled to grant those roles (`users.service.ts:265-320` only validates the role IDs exist). **Any authenticated user can create a brand-new user with `roleIds: [<Business Owner role id>]`.**

Either bug alone lets a Cashier become a Business Owner in one API call. Fix these two first, independent of the rest of this plan's sequencing — see Closing Plan item 1.

## Current state — what's actually there

### Data model (`backend/prisma/schema.prisma`)

- `Permission` is a real structured model (`module`, `resource`, `action` columns, `@@unique([module, resource, action])`), flattened to `module:resource:action` only at the app layer. Not a flat string table — good foundation.
- `User` ↔ `Role` and `User` ↔ `Branch` are both modeled many-to-many (`UserRole`, `UserBranch` join tables) — the schema supports multi-role and multi-branch users.
- **But at runtime, branch scoping never uses `UserBranch`.** Every actual authorization check reads `Employee.branchId` (a single nullable FK) instead — set via `jwt.strategy.ts:155-157,172-173` and `users.service.ts:869-872`. `UserBranch` is populated by the admin "assign branches" UI and displayed in the session payload, but **zero permission check, controller, or service in POS/Inventory/Accounting/CRM ever reads it.** Assigning a user to two branches via the UI has no effect on what they can actually access — they remain scoped to whichever single branch their `Employee` record points at.
- Real wildcard permission rows (`resource: '*', action: '*'`) exist in the seed for several modules — matching is genuine string-wildcard logic (`backend/src/auth/utils/permission-check.util.ts:10-27`), not special-cased.
- ~261 permission rows across 9 modules (`inventory` 85, `accounting` 74, `crm` 26, `procurement` 23, `pos` 15, `admin` 15, `queue` 9, `sales` 8, `files` 6) — per `backend/prisma/seed.ts`.

### Enforcement mechanism

- Live path: `JwtAuthGuard` (authenticates) → `PermissionsGuard` (authorizes), driven by `@RequirePermissions(...)`. **The decorator is inert without the guard also present** — this pairing must be applied manually per-controller, and it isn't applied consistently (see below). This is the single biggest structural cause of the "buggy" reports.
- `Role.isActive` is **never checked** at the point of enforcement (`permission.gaurd.ts:63-68`, `permission-check.util.ts:47-51` both flatten permissions with no `isActive` filter). Deactivating a role via `RolesService.remove()`'s soft-delete has **zero effect** on users still holding it. A correct version of this check exists (`CurrentUserGuard`, `auth/gaurds/current-user.gaurd.ts:47-49`) but is dead code — never applied anywhere in the app.
- Admin-module permissions were **not seeded at all** until a manual backfill script (`scripts/backfill-admin-permissions.ts:13-18`, whose own comment admits: _"referenced by `@RequirePermissions(...)` throughout the app but never actually existed as Permission rows — meaning no role, including Business Owner, could ever satisfy these checks"_). A live, in-repo admission of exactly this bug class.
- Password reset is gated on `role.hierarchyLevel === 1` (`auth.service.ts:409-418`), a hardcoded magic number entirely outside the permission system. Every custom role a Business Owner creates gets the schema-default `hierarchyLevel: 3` (never settable via the API) — **no custom role can ever pass this check, regardless of what permissions it holds.**
- Three separate, partially-overlapping guard implementations exist in the codebase (the live `JwtAuthGuard`/`PermissionsGuard` pair, the dead `CurrentUserGuard`, and a fully unused `AuthorizationGuard` built on a different auth library) — accumulated debt from at least three iterations of the auth layer.

### Branch-scoping — not systemic, bolted on per-endpoint

`PermissionsGuard` has **no concept of branch at all** — it is a pure string match on `module:resource:action`. Branch-scoping exists only where an individual controller/service remembers to add it, via a copy-pasted convention (`branchId: user.branchId ?? filters.branchId`, with a near-identical comment repeated across 12 files). There's a real historical fix for exactly this problem (`f4143b4 fix(pos,inventory): enforce branch scoping server-side, not just via client filters`, whose own commit message describes a Manila manager able to see/act on Cebu's data across ~15 endpoints) — but it patched specific endpoints, not the mechanism, and later additions have the same gap:

- **Within the same controller file**, some routes are scoped and sibling routes aren't. E.g. `transactions.controller.ts`: `findAll()` is branch-scoped, but `findOne(id)`, `addPayment(id)`, and `getCustomerHistory()` take no branch parameter at all — any transaction from any branch is fetchable/mutable by ID alone. `stock.controller.ts`: `getLedger()`/`getReceivingReports()` are scoped (the exact two routes the historical fix touched); `getBalances()`, `receiveStock()`, `processReturn()`, and five others in the same file are not.
- **CRM has zero branch-scoping, and the schema can't currently support it** — no `branchId` column exists on `Customer`, `Lead`, `Interaction`, or `Agent` at all. This needs a migration before it can be scoped, not just a code fix.
- **Bank accounts** (`bank-accounts.controller.ts`) have no permission guard _or_ branch check on CRUD — only one route in the file (`clearCashInTransit`) checks anything.
- Quantified sweep: **14 of 22 POS controllers, 7 of 20 Accounting controllers, and 6 of 7 CRM controllers have zero `PermissionsGuard`/`RequirePermissions` reference anywhere in the file.** `POST /pos/transactions` itself — creating a sale — has no permission guard at all.

### Branch Manager's actual grant

Contrary to a prior recollection of a broad `module:*` wildcard grant, the current seed (`seed.ts:1882-1954`) gives Branch Manager a **curated ~60-permission allowlist**, mostly `:read`, plus specific creates/manages (receiving, receipt config, financing terms, CIT clearing, PR/PO workflow). Notably it does _not_ include `pos:sessions:open/close`, `pos:transactions:create`, or `accounting:journalEntry:create/update/delete` — under a strict reading, Branch Manager can't open a session or ring a sale through the guarded path. This is moot only because those routes have no guard at all (see above) — which is itself the problem, not a fix.

**Because `PermissionsGuard` has no branch concept, this 60-permission grant behaves as flat and enterprise-wide wherever the endpoint doesn't separately implement branch-scoping** — a Branch Manager's `:read` permissions often resolve to "read this resource across every branch," not just their own. This directly contradicts the target model and is the core reason Branch Manager's access doesn't currently match "everything in their branch only."

### Module scoping for Employee-level roles

The design is sound in principle: which modules a role can touch falls naturally out of which permissions it holds (Cashier gets `pos:*`/limited `inventory:*`/`accounting:account:read`; Stock Controller gets `inventory:*`/`procurement:*`). There's no separate module-allowlist mechanism — `moduleAccess` in the session payload is purely a nav-display projection, never consulted by any guard. **This only holds where the corresponding endpoint actually enforces its declared permission.** Since CRM has zero guards anywhere, a Cashier — holding no `crm:*` permission at all — can currently create, edit, and delete CRM customers and leads. The scoping model is correct; the enforcement gaps break it.

### Custom role builder — why it's "all over the place"

- **The module-grouping UI covers only 4 of 9 real modules.** `AssignPermissionsModal`'s "module access level" cards (`access-levels.ts:18-23`) exist for `accounting`/`inventory`/`pos`/`crm` only. The other 61 permissions (`procurement`, `admin`, `queue`, `sales`, `files`) have no grouped shortcut — reachable only via a flat, unpaginated 261-row "Advanced permissions" search list.
- **`CreatePermissionModal` can only create permissions in `hr`/`accounting`/`inventory`/`admin`** (`COMMON_MODULES`) — even though `hr` has zero seeded permissions and doesn't appear anywhere else in the app, while `pos`/`crm`/`procurement`/`queue`/`sales`/`files` (all real, seeded modules) can't have new permissions created through this UI at all.
- **A role can be saved with zero permissions** — no validation on either side (`CreateRoleDto.permissionIds` is `@IsOptional()`, no `@ArrayMinSize`, and the frontend save button is never disabled for an empty selection).
- **There is no dependency/grouping model anywhere in the backend** — `Permission` has no category/group/parent field, and `RolesService.assignPermissions()` validates only that permission IDs exist, nothing about whether the combination makes sense (e.g. `update` without `read`). All structure that exists is a frontend-only heuristic (`access-levels.ts`'s string matching on the `action` field) with no backend counterpart.
- **A concrete UI-says-yes/backend-says-no bug**: the seed documents `*:manage` as an "alias of create/update/delete," and several Next.js server actions treat it that way (`can(session, 'x:y:update') || can(session, 'x:y:manage')`) — but the actual NestJS `PermissionsGuard` only ever checks the literal action a route declares, never substituting `manage` for a specific action. A Business Owner who grants a custom role only `*:manage` (reasonably, given the seed's own description) gets a role that passes the frontend gate, shows the button, submits the form, and then gets a 403 from the real API.
- **Edit and Delete are dead buttons for both roles and permissions.** `RolesSection.tsx`'s `handleToggleActive`/`handleDelete` and `PermissionsSection.tsx`'s `handleDelete` are literal `// TODO` / `console.log` stubs that never call the backend, even though the backend endpoints exist and work. There is no "Edit Permission" UI at all despite a working `PATCH /permissions/:id`.
- **`isActive` can never be set back to `true` via the API** — not exposed on `CreateRoleDto`/`UpdateRoleDto` at all; the only write path is the soft-delete setting it to `false`. Combined with `isActive` never being checked at enforcement time anyway (see above), this field is currently decorative in both directions.
- **A second, unguarded branch-manager-assignment endpoint exists.** `POST /branches/:id/managers` (`branches.controller.ts`) has no `PermissionsGuard` at all — any authenticated user in the tenant can assign themselves or anyone as a branch's manager, or create/deactivate branches. It also does `where: { name: 'Branch Manager' }` — if that literal role is ever renamed (nothing currently prevents this), the lookup silently returns `null` and the user is set as the branch's manager with **zero actual role permissions**, a silent broken state with no error surfaced anywhere.
- **Hardcoded role-name checks are widespread — 15+ locations across both repos**, bypassing the permission system entirely for anything checking "is this the Business Owner / Branch Manager." Two independently-maintained copies of the same role→module-access table exist in the frontend (`libs/guards/permission.ts` and `hooks/usePermission.ts`), with a comment in the latter admitting they must be kept in sync manually. If the "Business Owner" role name is ever renamed via the (currently unrestricted) role-edit endpoint, every one of these checks silently breaks.
- **Employee self-service profile "update" doesn't exist** — both `EmployeeProfileView.tsx` and `OwnerProfileView.tsx` are 100% read-only, no form, no save action. Only password change is self-serviceable.

## Target model

- **Business Owner** — access to everything, everywhere. Already close to correct by exhaustive permission enumeration, but currently undermined by the hardcoded-name bypasses (fragile — breaks silently on rename) and the enforcement gaps that make "permission-based access" meaningless on unguarded routes.
- **Branch Manager** — access to everything, scoped to their own branch. Requires two changes together: (a) branch-scoping becomes a first-class, systemic part of the permission check rather than a per-endpoint convention, and (b) once that containment exists, Branch Manager's grant can be safely broadened toward real module-level access (matching "everything in their branch") without the enterprise-wide leakage that broadening would cause today.
- **Employee-level** — module- and branch-scoped. The permission-assignment model already produces this correctly in design; it needs the same systemic branch-scoping as Branch Manager, plus full guard coverage so a role's absence of a permission actually blocks the action (not just hides a button).

## Closing plan

Ordered by risk — security first, then the structural fix everything else depends on, then the specific broken flows, then the role-builder UX redesign.

### 1. Fix the two privilege-escalation bugs (do this before anything else)

**Fix**: add `@UseGuards(PermissionsGuard)` to `RolesController` (class-level, matching the working pattern already used correctly in `PermissionsController`) and add `@UseGuards(PermissionsGuard)` + `@RequirePermissions('admin:users:create')` to `UsersController.create()`. Both are small, isolated, high-value changes — ship them standalone, don't bundle with the rest of this plan.

### 2. Make `Role.isActive` actually mean something

**Problem**: deactivating a role has zero runtime effect; a dead guard (`CurrentUserGuard`) already has the correct logic.
**Fix**: add the `ur.role.isActive` filter directly into `PermissionsGuard`'s and `permission-check.util.ts`'s permission-flattening logic (the two live call sites), matching what `CurrentUserGuard` already does correctly. Then either wire `CurrentUserGuard` in properly or delete it — don't leave a second, unused implementation of the same check to drift further. Also add `isActive` to `UpdateRoleDto` and a real reactivate path (`PATCH /roles/:id` with `isActive: true`), since currently no endpoint can undo a soft-delete.

### 3. Make branch-scoping systemic, not per-endpoint

This is the highest-leverage structural fix in this plan — it's the prerequisite for the Branch Manager and Employee target models both.

**Design direction**: two distinct needs, both currently missing a shared mechanism:

- **List/filter endpoints** — the query itself must be constrained to the caller's branch. Add a `@ScopeToBranch()` decorator (default-applied at the controller level for branch-relevant modules, with an explicit `@NoBranchScope()` opt-out for genuinely enterprise-wide resources) read by an interceptor or an extended `PermissionsGuard` that injects `branchId` into the request context, so every service method receives an already-validated branch filter instead of each one re-deriving `user.branchId ?? filters.branchId` by convention.
- **Single-record endpoints by ID** (`findOne`, `update`, `remove`, `void`, `post`, `reverse`, etc.) — the fetched record's own branch must be checked against the caller's after the fetch, or the query must include the branch filter directly. This is the class of bug found in `transactions.controller.ts`/`journal-entries.controller.ts` (record readable/mutable by ID regardless of branch). Add a shared helper (e.g. `assertOwnBranch(record.branchId, user)`) used consistently, rather than leaving this to be remembered per-service.

**Sequencing**: this needs a controller-by-controller sweep once the mechanism exists — prioritize the modules the audit found weakest first: POS (14/22 unguarded), Accounting (7/20 unguarded, including bank accounts), then CRM (needs the schema migration below first).

### 4. Add `branchId` to CRM's schema, then scope it

**Problem**: `Customer`, `Lead`, `Interaction`, `Agent` have no branch column at all — CRM can't be branch-scoped without a migration first.
**Fix**: add `branchId` (nullable, since some CRM records may legitimately be enterprise-wide — confirm with the business whether _all_ customers should be branch-owned, or only some entry points) to these models, backfill from existing data where derivable, then apply the guard/scope mechanism from item 3. Also add `PermissionsGuard`/`RequirePermissions` to the CRM controllers that currently have none (6 of 7) — right now a Cashier can touch CRM data despite holding zero `crm:*` permissions, independent of the branch question.

### 5. Reconcile `manage` between frontend and backend

**Problem**: several Next.js server actions treat `resource:manage` as equivalent to `create`/`update`/`delete`; the real NestJS guard never does.
**Fix**: pick one behavior and make both sides match. Likely direction: extend `matchesPermission` (backend) to treat `manage` as satisfying any of `create`/`update`/`delete`/`read` for the same `module:resource`, mirroring what the frontend already assumes and what the seed's own permission descriptions promise — rather than stripping `manage` handling out of the frontend, since Business Owner UX already depends on it.

### 6. Rebuild Branch Manager's grant once branch-scoping is systemic

**Problem**: today's curated 60-permission allowlist is missing operational essentials (session open/close, transaction create) and, per item 3, isn't actually contained to one branch anyway.
**Fix**: once item 3 lands, move Branch Manager toward real `module:*` grants for pos/inventory/accounting/crm/procurement (matching "everything in their branch"), since the containment now comes from branch-scoping rather than from a hand-curated action list. This is a permission-seed change, not a guard change — sequence it after item 3, not before, or it re-creates the enterprise-wide leakage problem at a larger scale.

### 7. Eliminate hardcoded role-name checks

**Problem**: 15+ locations (two of them entire duplicated access-logic files) hardcode `'Business Owner'`/`'Branch Manager'` string comparisons instead of using the permission system, silently breaking if either role is ever renamed — which nothing currently prevents.
**Fix**: two parts. (a) Replace each hardcoded check with the equivalent permission check (e.g. `hasPrivilegedRole` → `can(session, '*:*:*')` or a dedicated `admin:*:*` check) — do this as a tracked sweep, not all at once, since some of these sit in hot navigation-rendering paths and deserve individual verification. (b) Protect the seeded system-role names server-side (reject a rename/delete of `Business Owner`/`Branch Manager`/etc. at the API level, not just hide the button in `RolesSection.tsx`'s `PROTECTED_ROLE_NAMES` UI-only list) as a stopgap while (a) is in progress.

### 8. Fix the specific broken UI flows

Smaller, independent fixes — can be parallelized once the above is underway:

- Wire up `RolesSection`'s delete/deactivate and `PermissionsSection`'s delete to their existing, working backend endpoints (currently `TODO` stubs).
- Build the missing "Edit Permission" UI against the existing `PATCH /permissions/:id`.
- Fix `CreatePermissionModal`'s module list to match the real 9 modules (drop `hr`, add `pos`/`crm`/`procurement`/`queue`/`sales`/`files`) and make `resource`/`module` free-text or dynamically sourced rather than a fixed button set.
- Guard `POST /branches/:id/managers`/`removeManager` properly (`PermissionsGuard` + `admin:users:update` or equivalent), and stop hardcoding `where: { name: 'Branch Manager' }` — resolve the role by a stable identifier, or at minimum surface an error instead of silently skipping the `UserRole` assignment when the lookup fails.
- Replace the `hierarchyLevel === 1` password-reset gate with a real permission (e.g. `admin:users:reset-password`), so a custom role can be granted this capability — today no custom role ever can, regardless of intent.
- Add button-level permission checks to `UserDetailDrawer.tsx` (Reset Password / Edit / Assign Role / Assign Branch / Deactivate / Delete are all shown unconditionally to any admin viewer today, several of which will 403 on click depending on the viewer's actual permissions).
- Build the missing self-service "edit my profile" form (`EmployeeProfileView`/`OwnerProfileView` are currently 100% read-only).
- Retire dead code once confirmed unused: `CurrentUserGuard` (fold its correct logic into the live guard per item 2, then delete it) or `AuthorizationGuard` (the unused `express-oauth2-jwt-bearer`-based guard) — and check whether `scripts/backfill-enterprise-owner-access.ts` is still needed; if not, remove it, since re-running it would recreate a stray duplicate `'enterprise-owner'` role.

## Custom role builder — redesign for "user-friendly, not all over the place"

The root cause the business suspects — "we lack limitations" — is accurate. The current builder has no structural limits at any layer (schema, backend validation, or UI), so "user-friendly" here means adding real constraints, not just better visuals.

1. **One consistent module taxonomy, everywhere.** Today the module list differs between `ACCESS_MODULES` (4 modules), `CreatePermissionModal`'s `COMMON_MODULES` (4 different modules, including a nonexistent `hr`), and the actual 9 seeded modules. Define the module list once (ideally server-driven — `GET /permissions/modules` returning the real set from the DB — rather than a second hardcoded frontend list that can drift), and have every picker/creator UI consume it.
2. **Every module gets a level-card (View / Manage / Full / None), not just 4 of 9.** Extend `ACCESS_MODULES` to cover all real modules, generated from the module taxonomy in (1) rather than hand-maintained.
3. **Role templates/presets for the three target-model tiers**, offered as a starting point when creating a role — "Branch-Manager-like," "Employee (single module)," "Custom from scratch" — so most custom roles start from a sane baseline instead of an empty 261-checkbox list. This directly serves the target model: an Employee-tier preset would default to zero cross-module access, requiring deliberate opt-in per module.
4. **Require at least one permission to save a role**, with a clear inline reason, on both frontend (disable save) and backend (`@ArrayMinSize(1)` on `CreateRoleDto.permissionIds`, or an explicit service-level check with a clear error).
5. **Show a live warning for risky combinations** — e.g. a wildcard (`*:*`) grant outside of a small explicitly-marked set of admin-tier roles, or `manage` granted without any of `create`/`read`/`update`/`delete` explicitly (once item 5 above reconciles their relationship, this becomes an informational note rather than a real gap). This doesn't need to _block_ saving — Business Owner should retain the ability to build unusual roles — but it should stop silent surprises.
6. **Fix the `CreatePermissionModal` module/resource mismatch** (per Closing Plan item 8) so creating a new permission and assigning it to a role use the same, current module list.
7. **Surface the branch-scoping dimension in the builder itself**, once item 3 lands — e.g. a per-permission or per-role toggle showing "this grant applies within the holder's assigned branch" vs. "enterprise-wide" (relevant mainly for Business-Owner-tier custom roles that might legitimately need cross-branch access to a specific module). Right now this dimension is invisible in the UI entirely, which is part of why the resulting access has been unpredictable.

## Verification

This is a planning-only deliverable — no code has been changed. Recommended verification once implementation begins, in the same order as the Closing Plan:

- Item 1: confirm a non-privileged test user gets a 403 from `POST /roles/:id/permissions` and `POST /users` with an escalated `roleIds` payload.
- Item 2: deactivate a role a live user holds, confirm their next request using that role's permissions is rejected.
- Item 3: for a representative single-record endpoint per module (e.g. `GET /pos/transactions/:id`), confirm a Branch-Manager-scoped user gets a 403/404 for another branch's record ID, not just a filtered list.
- Item 4 (CRM): confirm the migration backfills existing records sensibly before enabling the guard, to avoid locking out access to un-branched historical data.
- Item 6: after broadening Branch Manager's grant, re-run the item 3 verification to confirm the broader grant is still properly contained per-branch.
- Custom role builder: build a role via each of the three presets (Branch-Manager-like / single-module Employee / custom) and confirm the resulting user's actual API access matches what the builder implied — this is the concrete test that the "all over the place" problem is resolved.
