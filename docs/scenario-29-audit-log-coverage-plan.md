# Scenario 29 — Full Transaction Audit Log Coverage — Gap Analysis & Closing Plan

Source: developer-requested follow-up (2026-08-17), same day the `UserAuditLog` system's first real surfaces shipped (`GET /audit-logs`, `GET /audit-logs/recent`, the Settings "Audit Logs" page, and the dashboard's "Recent Activity" widget — backend PR #124 / frontend PR #132). Not sourced from either scenario PDF — this is an operator ask, not a PDF-mapped row. Overlaps with [Scenario 21](./scenario-21-role-queues-maker-checker-plan.md)'s Closing Gap 3 (`AccountingAuditLog`); this doc absorbs and supersedes that specific item — Scenario 21 should link here instead of duplicating it once this lands.

**Scope note (developer-confirmed, 2026-08-17)**: priority order across the untouched modules is money-first — Accounting → Credit & Collections → Inventory (remainder) → CRM → remaining POS admin. `AccountingAuditLog` is being wired up for real before/after diffs, not removed. New instrumentation will go through a new `@AuditLog(...)` decorator + interceptor rather than continuing the existing hand-rolled call-per-controller-action pattern, since the remaining scope is ~30+ new call sites.

**Correction (re-verified 2026-08-17, immediately before implementation)**: `PayrollAuditLog` was originally flagged here as an orphaned-but-present table needing a drop migration. Re-verification found it's already gone — the model was deleted from `schema.prisma` and its table dropped via `DROP TABLE "payroll_audit_logs"` in migration `20260620050202_remove_hr_schema`, dated 2026-06-20 (part of a broader HR/payroll/attendance/leave/tax schema removal), well before this doc was written. There is nothing left to close on this item — struck from the closing-gaps list below, not implemented as a task.

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill once this doc is confirmed.

## The scenario we're building toward

A business owner opens Audit Logs (or the dashboard's Recent Activity feed) and finds a complete, trustworthy record of who did what to the business's data, when — not just the handful of action types that happen to be logged today:

1. Every financially-material or operationally-material action across every module — not only auth/roles/permissions/users and a few POS/PO flows — writes an audit entry.
2. Accounting edits capture real before/after values (`oldValues`/`newValues`), not just a generic metadata blob, so a disputed journal entry or fiscal-period reopen can be reconstructed exactly.
3. Coverage is declarative and hard to silently skip when a new endpoint is added, rather than depending on every future developer remembering a manual call.
4. The business owner's full log and the dashboard's curated recent-activity feed both reflect the same underlying trail, deliberately scoped differently (full vs. curated), and no dead/orphaned audit tables linger to confuse anyone relying on them.

**Result**: no module can silently mutate business data without a durable, attributable trail.

## What's already done ✅

1. **A generic, tenant-scoped audit-log system already exists end-to-end.** `backend/src/audit-log/` — `AuditLogService` (`resolveUserScope()`, `writeLog()`, `writeLogForUser()`, `findAll()`, `findRecentForTenant()`), `AuditLogController` (`GET /audit-logs`, `GET /audit-logs/recent`), backed by the `UserAuditLog` Prisma model (migration `20260609104111_rbac_31_user_audit_logs`).
2. **A full business-owner-facing Audit Logs page**, permission-gated on `admin:audit-logs:read`: `frontend/src/app/(app)/(dashboard)/settings/audit-logs/page.tsx` + `AuditLogsSection.tsx` (actor/resourceType/date-range filters, pagination, scope badges for ALL/BRANCH/DEPARTMENT, action-color chips), backed by `get-audit-logs.ts` and validated against `src/schema/settings/audit-logs.ts`.
3. **A dashboard "Recent Activity" widget** (shipped today, commit `32d08c2`), permission-gated on `workspace:activity:read`, reading a deliberately narrow allowlisted slice of the same table (`RECENT_ACTIVITY_RESOURCE_TYPES` in `audit-log.service.ts:15-19`): `frontend/src/app/(app)/(dashboard)/_actions/activity-actions.ts` + `RecentActivityWidget.tsx`.
4. **Modules already instrumented** (write to `UserAuditLog` today): `auth.service.ts` (login), `roles.controller.ts` (role CRUD), `permissions.controller.ts` (permission grant/revoke), `users.controller.ts` (user CRUD, invite-link read, status/role changes), `pos/transactions.controller.ts` (sale completion), `pos/return-refund-requests.controller.ts` (approval), `inventory/controllers/purchase-order.controller.ts` (approval).
5. **The pattern for adding new instrumentation is proven**, just manual and split across two call shapes today (re-verified 2026-08-17, correcting the original single-shape claim here): `writeLog(dto)` — the shape actually used at both reference call sites this doc originally pointed to (`pos/transactions.controller.ts:155`, `inventory/controllers/purchase-order.controller.ts:147`) — takes a flat `CreateAuditLogDto` and computes `scopeType`/`scopeBranchId` inline from data already in hand (`user.branchId` or the entity's own `branchId`), with no DB round-trip. `writeLogForUser(user, details)` — used by `roles.controller.ts`, `permissions.controller.ts`, `users.controller.ts`, and `auth.service.ts`'s login path — takes the actor plus a narrower `details` object and calls `resolveUserScope(user.id)` internally (an async `UserBranch` lookup) to compute scope. The new decorator (Closing Gap 1) needs to decide which of these two it mirrors, or exposes both.

6. **No custom `NestInterceptor` exists anywhere in this codebase yet** (confirmed via `grep -rln "implements NestInterceptor" backend/src/` — zero hits; only Nest's built-in `FileInterceptor` is used, for uploads). The closest existing analog for a decorator-driven cross-cutting concern is `PermissionsGuard` + `@RequirePermissions()` (`SetMetadata` + `Reflector.getAllAndOverride`, `backend/src/auth/gaurds/permission.gaurd.ts` — the `gaurds`/`gaurd` misspelling is the real path throughout this codebase, not a typo to fix in passing) — worth mirroring that wiring style since it's the one established precedent, even though the mechanism itself (interceptor vs. guard) differs.

## What's not done / gaps ❌⚠️

1. **Most transactional modules are silent** — no audit trail at all, confirmed by grep (no `AuditLogModule` import, no `writeLog`/`writeLogForUser` call):
   - **Accounting**: journal entries, AP bills, AR invoices, tax, budgets, bank reconciliation. Fiscal-period reopen has its own bespoke `reopenedBy`/`reopenedAt` fields but never reaches the unified trail.
   - **Credit & Collections**: credit applications/approvals, collections, collector-remittance, installment accounts.
   - **Inventory (remainder)**: adjustments, transfers, stock counts, batches, price lists, purchase requests, SKU reservations, item edits, costing/revaluation. (`ItemChangeLog` covers item-field history specifically — narrower than a general transaction log, worth deciding overlap/dedup against once Inventory is in scope.)
   - **CRM**: leads, customers, reminders, interactions.
   - **POS beyond sale-completion/return-refund**: voids, sessions, promo codes, gift cards, loyalty, GL mapping, terminals, discounts.
2. **`AccountingAuditLog` is dead code.** Real `oldValues`/`newValues` Json fields exist (`schema.prisma:833-851`), migrated, but zero writes anywhere in `backend/src`. Already flagged in Scenario 21 and `docs/scenario-checklist.md:48`. **Re-verified 2026-08-17, new finding**: the model also has no `enterpriseOwnerId` (or any tenant-scoping field at all) — `userId`/`userName` are plain unrelated strings, no relation to `User`/`EnterpriseOwner`. `UserAuditLog` (the model actually in use) does have `enterpriseOwnerId`, indexed, and every read path filters on it. Wiring Gap 2 up for real needs this decided first — see Closing Gap 2.
3. ~~`PayrollAuditLog` is a fully orphaned table.~~ **Struck 2026-08-17** — re-verification found the model and its table were already fully removed on 2026-06-20 (see correction note above). Nothing to do here.
4. **No declarative logging abstraction.** Every instrumented action today is an explicit `writeLogForUser()` call added by hand inside the controller. Scaling that to ~30+ new sites by hand is repetitive and easy to miss on a future endpoint.
5. **Frontend generated OpenAPI types are stale.** `src/libs/generated/types/generated.ts` has `/audit-logs` but is missing `/audit-logs/recent` entirely (confirmed via grep) — the frontend hand-rolls a Zod schema / plain interface instead. Needs `pnpm generate:types` against a running local backend.
6. **`RECENT_ACTIVITY_RESOURCE_TYPES` is a hardcoded 3-item allowlist** (`audit-log.service.ts:15-19`) with an explicit inline comment that new `writeLogForUser()` calls do _not_ automatically surface on the dashboard. As coverage grows, each new resourceType needs a conscious decision (full-log-only vs. also-on-dashboard), not silent inclusion or silent omission.
7. **No tests for the audit-log module itself.** Other modules mock `AuditLogService` in their own specs; `audit-log.service.ts`/`audit-log.controller.ts` have none of their own (no unit test for `resolveUserScope`/`findAll`/`findRecentForTenant`, no e2e for either endpoint).
8. **Adjacent, out of scope for this doc**: the Super Admin "Audit Logs" page (`frontend/src/app/(super-admin)/super-admin/audit-logs/page.tsx`) is still a "Coming Soon" placeholder even though its backend endpoint (`GET /super-admin/audit-logs`, a separate platform-level `AuditLog`/`SuperAdmin` model, unrelated to `UserAuditLog`) already works. Different audience (platform ops, not business owner) — worth its own small ticket, not folded into this one.

## Closing the gaps

Ordered by dependency and business-confirmed priority (money-first).

### 1. Build the `@AuditLog(...)` decorator + interceptor (foundation — do this first)

**Problem**: every future instrumentation site is a hand-written call, easy to forget, inconsistent in what gets captured.
**Fix**: a NestJS interceptor + method decorator, e.g. `@AuditLog({ resourceType: 'accounting:journal-entry', action: 'CREATE' })`, applied on controller actions. Resolves actor/scope from the authenticated request (mirroring `resolveUserScope()`), resolves `resourceId`/`resourceName` from the response body where possible (with an escape hatch for cases that need explicit resolution), and calls the existing `AuditLogService.writeLogForUser()` after a successful response — never blocking or failing the underlying request if logging itself errors, matching today's fire-and-forget `writeLog()` behavior. Decide whether it also supports capturing `oldValues`/`newValues` generically, or whether that stays a separate, explicitly-called path used only where Gap 2 needs it (Accounting).

### 2. Wire up `AccountingAuditLog` for real before/after diffs

**Problem**: a schema field that looks like a real audit trail but silently isn't one is a risk for anyone relying on it for compliance or dispute resolution.
**Fix**: on financially-material Accounting edits (journal entries, AP bills, AR invoices, fiscal-period reopen, budgets, bank reconciliation), capture actual `oldValues`/`newValues` before persisting the change and write via `AccountingAuditLog` specifically — it's the model built for that, not a generic `UserAuditLog` metadata blob. Fold the existing bespoke fiscal-period `reopenedBy`/`reopenedAt` fields into this same unified trail rather than leaving them as a second, disconnected record of the same event.
**Open question (found 2026-08-17)**: `AccountingAuditLog` has no `enterpriseOwnerId`/tenant-scoping field today, unlike `UserAuditLog`. Needs a migration adding it (and backfilling reads to filter on it) before this table is safe to expose through any multi-tenant-aware endpoint — otherwise one tenant's financial audit trail is queryable cross-tenant the moment a read endpoint exists for it.

### 3. Instrument Accounting (phase 1 — money-first)

Journal entries, AP bills, AR invoices, tax, budgets, bank reconciliation, fiscal-period reopen (via Gap 2's before/after path where applicable, `@AuditLog` decorator for the rest).

### 4. Instrument Credit & Collections (phase 2)

Credit applications/approvals, collections, collector-remittance, installment accounts.

### 5. Instrument Inventory remainder (phase 3)

Adjustments, transfers, stock counts, batches, price lists, purchase requests, SKU reservations, item edits, costing/revaluation. Decide overlap with `ItemChangeLog` (item-field history) before duplicating coverage on item edits specifically.

### 6. Instrument CRM (phase 4)

Leads, customers, reminders, interactions.

### 7. Instrument remaining POS admin (phase 5)

Voids, sessions, promo codes, gift cards, loyalty, GL mapping, terminals, discounts beyond return-refund.

### ~~8. Drop `PayrollAuditLog`~~ — struck 2026-08-17, already done as of 2026-06-20

No action needed; see correction note at the top of this doc.

### 8. Regenerate frontend OpenAPI types

**Fix**: run `pnpm generate:types` against a running local backend once each phase's endpoints stabilize, so `/audit-logs/recent` (and any new query params) get real generated types instead of hand-rolled ones.

### 9. Decide Recent Activity widget growth per phase

**Fix**: as each phase (3-7) lands, explicitly decide with the business owner whether its new resourceTypes join `RECENT_ACTIVITY_RESOURCE_TYPES` or stay full-log-only — avoid silently bloating (or silently under-filling) the dashboard feed as a side effect of unrelated phase work.

### 10. Add tests for the audit-log module

**Fix**: unit tests for `AuditLogService` (`resolveUserScope`, `writeLog`, `writeLogForUser`, `findAll`, `findRecentForTenant`) and e2e coverage for both controller endpoints. Add incrementally alongside each phase's own tests rather than as one deferred catch-all task.

## Dead code / unused-feature flags

- **`AccountingAuditLog`** — see Closing Gap 2 (being wired up for real, not removed — plus its own new tenant-scoping open question). Supersedes Scenario 21's identical item.
- ~~`PayrollAuditLog`~~ — already fully removed 2026-06-20, not orphaned. Struck from this doc's scope 2026-08-17.

## Implementation Log — 2026-08-17

**For this scenario, I have done:**

- **Closing Gap 1 (foundation)**: built `@AuditLog(...)` (`backend/src/audit-log/decorators/audit-log.decorator.ts`) + `AuditLogInterceptor` (`backend/src/audit-log/interceptors/audit-log.interceptor.ts`), mirroring the `@RequirePermissions`/`PermissionsGuard` metadata-decorator wiring style — the only existing precedent in this codebase (no prior `NestInterceptor` existed anywhere). Resolves the actor off `request.user`, resolves `resourceId`/`resourceName` from the response body (with an override escape hatch), and — per the developer's confirmed choice to build in generic diff support rather than keep it simple — optionally diffs a `captureDiff.loadBefore()` snapshot against the response into `metadata: { oldValues, newValues }` before writing via the existing `AuditLogService.writeLogForUser()`. `AuditLogModule` now also provides/exports `AuditLogInterceptor`. Proven via a throwaway fixture controller + `test/audit-log-interceptor.e2e-spec.ts` (4/4 passing: simple write, diff-capture write, undecorated route logs nothing, unauthenticated request rejected). `tsc --noEmit` and `eslint` both clean. Not committed yet (pending developer go-ahead); working branch `feat/scenario-29-transaction-audit-coverage` on both repos.

**Worth flagging:**

- Phase 1 re-verification (before any code was written) corrected two things in this doc's original gap analysis, both already folded into the sections above: `PayrollAuditLog` was flagged as orphaned-but-present — it was actually already fully removed (model + `DROP TABLE`) on 2026-06-20, so Closing Gap 8 was struck as a no-op rather than implemented. `AccountingAuditLog` was found to have no tenant-scoping field at all (no `enterpriseOwnerId`), a new finding not in the original doc — developer decided (2026-08-17) this gets a migration as part of Closing Gap 2, not this run.
- Developer-confirmed run scope (2026-08-17): this session targeted **Closing Gap 1 only** ("foundation only"). Closing Gaps 2-10 — `AccountingAuditLog` wiring + its new tenant-scoping migration, the five module-instrumentation phases (Accounting split one-part-per-sub-module per developer's choice, Credit & Collections, Inventory remainder, CRM, remaining POS admin), OpenAPI regen, Recent Activity allowlist decisions per phase, and the audit-log module's own unit tests — remain open for a future session. Re-running `/implement-scenario 29` picks this back up at Phase 1's re-verify step.
- No production controller uses `@AuditLog`/`AuditLogInterceptor` yet — by design, this part is infrastructure only. There's no live route to manually click-test yet (the fixture controller only exists inside the Jest test process); the e2e suite is the real verification for this part specifically. Manual testing becomes meaningful starting with whichever part first wires a real controller.

## Implementation Log — 2026-08-17 (continued)

**For this scenario, I have done:**

- **Closing Gap 2**: `AccountingAuditLog` wired up for real. Migration adds a tenant-scoping column — first built as `tenantId` (matching sibling Accounting models like `TaxRateChangeRequest`), then renamed to `enterpriseOwnerId` per developer correction to match `UserAuditLog`'s naming convention (migrations `20260817040301`/`20260817052705`). New `AccountingAuditLogService.write()` (`backend/src/audit-log/accounting-audit-log.service.ts`), fire-and-forget like every other writer. Wired into fiscal-period reopen (`POST /fiscal-periods/:id/reopen`) as the first concrete example — writes a real before/after entry alongside (not instead of) the pre-existing `PeriodReopenLog`.
- **Closing Gap 3 — all Accounting sub-modules instrumented**, money-first order, one part per sub-module:
  - **Journal Entries**: create/update/post/reverse/delete, reusing the existing `serialize()` for snapshots.
  - **AP Bills**: create/update/receive/raise-voucher/approve-voucher-online/approve-voucher-onsite/reject-voucher/record-payment/delete (9 actions) — new `snapshotBill()`/`logBillAudit()` helper pair. Side benefit: `receive()`/`recordPayment()` now pass the real `postedBy` (previously always `undefined`).
  - **AR Invoices**: create/update/send/record-payment/record-bulk-payment/cancel-payment/delete — same pattern via `snapshotInvoice()`. `recordBulkPayment()` logs one entry per invoice inside its existing loop.
  - **Tax Rates**: two resource types matching the real data model — `accounting:tax-rate-change-request` for the submit→approve/reject maker-checker lifecycle, `accounting:tax-rate` for direct set/unset-default actions. Deliberately left the separate, unrelated `/tax` (`TaxConfiguration`) module out — it has no tenant scoping anywhere in its service layer, unlike everything else instrumented this scenario, and looks like legacy/separate scaffolding rather than the real tax feature.
  - **Budgets**: create/update/delete.
  - **Bank Accounts & Reconciliation**: bank-account CRUD, reconciliation create/complete, adjusting-entry creation, Cash-in-Transit clearance — four resource types (`accounting:bank-account`, `accounting:bank-reconciliation`, `accounting:bank-adjusting-entry`, `accounting:cash-in-transit-clearance`). Flagged, not fixed (pre-existing, outside this scenario's scope): `BusinessBankAccount`/`BankReconciliation` have no tenant scoping anywhere in `BankAccountsService` — `findAll()` etc. return every tenant's rows with no `where` filter at all.
  - Full suite: 8 e2e spec files, 33 tests, all passing (`npx jest --config test/jest-e2e.json --runInBand --testPathPatterns "accounting-audit-log-"`). `createAdjustingEntry()`/`clearCashInTransit()` (bank accounts) and `recordBulkPayment()` (AR invoices) are wired identically to everything else but not e2e-covered — they need GL-mapping and/or real closed-POS-session/installment-schedule fixtures disproportionate to this pass. Real, acknowledged gaps, not silently skipped.
- **New: a real UI to see the snapshot**, beyond this doc's original scope (which only anticipated backend wiring, with Prisma Studio as the only inspection path). Developer asked repeatedly to see it in the app, so built it:
  - `AuditLogService.findAll()` rewritten as a single `UNION ALL` raw SQL query merging `UserAuditLog` and `AccountingAuditLog` into one correctly-paginated, correctly-filtered timeline (an in-app-code merge of two independently-paginated queries can't produce a correct page 2+ when interleaving differently-sized sources, so this had to be a real SQL union, not application-level merging).
  - Settings → Audit Logs table: rows carrying a real before/after snapshot are click-to-expand (chevron affordance), showing a compact Field/Before/After grid. Only fields that actually changed are shown (`JSON.stringify` comparison), and expand only appears when there's a genuine before _and_ after to compare — covers every "nothing to diff against" action (`CREATE`, `SUBMIT_CREATE`, `SUBMIT_UPDATE`, `SUBMIT_DEACTIVATE`, `REVERSE`, adjusting-entry creation, CIT clearance) generically rather than hardcoding action names, while still expanding `DELETE` (a real "before" worth showing) and every genuine transition. Nested object values (e.g. tax-rate approval's `appliedTaxRate`) render as `name: X, rate: 5, ...` rather than raw JSON, recursing for deeper nesting.
  - Removed the IP column (always empty — `ipAddress` is never actually populated by any writer in this codebase) and changed the page size from 20 to 10, both on request.
  - `scripts/seed-audit-log-samples.ts` — dev-only, self-cleaning (tagged via `metadata.seedTag`, safe to re-run) sample-data generator for both tables, since there was no way to see either surface populated without walking through the real app first.
- **Real bugs found and fixed along the way**:
  - The Tax Rates e2e spec's `setDefault()`/`unsetDefault()` calls mutate tenant-wide state (`BusinessSettings.defaultTaxRateId` + whichever `TaxRate` holds `isDefault`), not just the throwaway rate the test created — the test's cleanup only deleted its own rate, leaving the tenant's real default tax rate permanently un-defaulted and breaking POS transaction creation dev-wide ("No tax rate configured for ..."). Caught via the pre-existing `cit-monitor` e2e suite failing, root-caused, live data restored directly, and the test hardened to snapshot-and-restore the original default properly.
  - Three controllers (fiscal-period reopen, bank-reconciliation complete, tax-rate reject) built an asymmetric snapshot — a narrow `oldValues` (e.g. `{status: 'pending'}`) next to a _full_ `newValues` — which the frontend's new "only show changed fields" filter would've misread as every field having changed, when most just weren't in the narrow old snapshot to begin with. Fixed all three to use the same field set on both sides, keeping only genuinely-new event info (like a reopen `reason`) asymmetric.

**Worth flagging:**

- Closing Gaps 8-10 remain open: frontend OpenAPI types are more stale than ever (this pass alone added several endpoints on top of the already-missing `/audit-logs/recent`), Recent Activity widget's allowlist untouched (still only the original 3 POS/Inventory resourceTypes — no Accounting type was added, matching its deliberately-curated design intent since the developer never asked for that), and `AuditLogService`/`AccountingAuditLogService` still have no unit tests of their own (only e2e coverage).
- Remaining money-first-adjacent phases per the original plan: **Credit & Collections (partially started — see below), Inventory remainder, CRM, remaining POS admin** — not started.
- The Part 1 `@AuditLog` decorator/interceptor was never actually used by any of this pass's module instrumentation — every controller uses the direct-call `AccountingAuditLogService.write()` pattern established in Part 2 instead. Worth a real decision in a future session: extend the interceptor to support an `AccountingAuditLog` target generically, or accept the direct-call pattern as the long-term shape for Accounting specifically.

## Implementation Log — 2026-08-17 (Credit & Collections phase begins)

**For this scenario, I have done:**

- **Credit Applications sub-area, all 4 controllers in `CreditModule`** (one part each, matching the established one-part-per-sub-module granularity):
  - **Credit Applications** (`credit:application`): create/update/submit/approve/decline/cancel — 6/6 new e2e passing.
  - **Credit Investigation** (`credit:investigation` + `credit:application`): `start()` logs the application's `submitted → under_investigation` transition; `record()` logs the new investigation record _and_ the application's `under_investigation → pending_approval` transition as two separate entries, so the application's full lifecycle stays visible under one resourceType filter. 2/2 new e2e passing.
  - **Promissory Note** (`credit:promissory-note`): `sign()` bulk-signs every unsigned note for an application in one call — logs one `SIGN` entry per note actually changed (skipping already-signed ones, matching the service's own no-op behavior). Not e2e-asserted directly — real `PromissoryNote` rows need a full POS installment-sale checkout (release form request + financing term, several required FKs), too heavy a fixture chain for this part — but functionally verified via `pos-installment-financing.e2e-spec.ts`'s real flow (25/25 passing with this change in place).
  - **Credit Application Documents** (`credit:application-document`): `attach()`/`remove()`. 1/1 new e2e passing.
  - Full-module regression: 35/39 passing across old + new specs — the only 4 failures are a pre-existing, unrelated stale test (see Worth Flagging).
- `AuditLogModule` added once to `CreditModule`'s own imports, covering all 4 controllers.

**Worth flagging:**

- Found (not fixed — out of this scenario's scope): `test/notifications-credit-application.e2e-spec.ts` (Scenario 26 Part 7) is stale independent of any Scenario 29 change. Its `createSubmittedApplication()` helper posts a bare `requestedAmount` with no `items[]` array, which `CreateCreditApplicationDto` has required since credit applications became item-scoped on 2026-08-15 (confirmed via direct `curl`: 400, `"items must contain at least 1 elements"`). `created.body.id` ends up `undefined`, cascading into 404s on every subsequent call in the helper and a Prisma validation crash in the file's own `afterAll`. Also logged in `scenario-checklist.md`.
- Credit & Collections still has real ground left: **Collector (+ collector-remittance), Installment Accounts, Collections** (calendar/incentive) — not started. Applications/Investigation/Promissory Note/Documents only covers the "credit applications/approvals" slice of this phase's original four-part framing ("credit applications/approvals, collections, collector-remittance, installment accounts").

## Implementation Log — 2026-08-17 (Collector & Installment Accounts)

**For this scenario, I have done:**

- **Collector & Remittance** (`crm:collector` / `crm:collector-remittance`, `CollectorController`): create/update/delete/remit — 4/4 new e2e passing. `AuditLogModule` added to `CollectorModule`'s own imports.
- **Installment Accounts** (`InstallmentAccountController`, by far the largest single controller instrumented this scenario — 12 mutating actions across 3 resource types):
  - `crm:installment-account` — `create`/`update`/`remove`/`earlyPayoff`/`recordPayment`/`updateLegalEscalation`, via a lean `snapshotAccount()` covering the ~20 fields these actions actually mutate (not the full `findOne()` relation graph).
  - `crm:installment-account-graduation-request` — `requestGraduation`/`approveGraduation`/`rejectGraduation`. `approveGraduation()` writes two entries: the request's own `pending → approved` transition, plus a second `GRADUATE` entry against `crm:installment-account` for the account's own `category` transition — same dual-logging shape already established for Credit Investigation's `record()`.
  - `crm:installment-account-dam-escalation-request` — `requestDamEscalation`/`approveDamEscalation`/`rejectDamEscalation`, same dual-logging shape: `approveDamEscalation()` also writes an `ENTER_DAM` entry against the account for the `inDam`/`damEnteredAt` transition.
  - `AuditLogModule` added to `InstallmentAccountModule`'s own imports.
  - 10/10 new e2e passing (`test/accounting-audit-log-installment-accounts.e2e-spec.ts`); full regression against the pre-existing `test/crm-collectors-installment-accounts.e2e-spec.ts` (76 tests) run together via `--runInBand`: 86/86 passing, no regressions.
- Full accumulated Scenario 29 regression across all 12 `accounting-audit-log-*.e2e-spec.ts` files run together via `--runInBand`: 52/52 passing.
- `tsc --noEmit` and `eslint --fix` both clean on every file touched this part.

**Worth flagging:**

- Closing Gap 4 (Credit & Collections) now has Applications/Investigation/Promissory Note/Documents, Collector/Remittance, and Installment Accounts all done. Only **Collections (calendar/incentive modules)** remains open within this gap.
- Unlike Promissory Note earlier in this phase (fixture chain too heavy for direct e2e, verified indirectly instead), every action in both Collector and Installment Accounts got direct e2e coverage this part — no disproportionate-fixture exceptions needed.

## Implementation Log — 2026-08-17 (Collection Incentives — Closing Gap 4 fully done)

**For this scenario, I have done:**

- **Collection Incentives** (`crm:collection-incentive`, `CollectionIncentiveController`) — the last sub-area of Closing Gap 4: `create`/`update`/`remove`/`approve`/`reject`, plus `generateMonthly()` (the monthly auto-rollup) logging one `CREATE` entry per incentive it actually creates, via the same controller-loops-over-the-service-response pattern already used for AR Invoices' `recordBulkPayment()`. 6/6 new e2e passing (`test/accounting-audit-log-collection-incentives.e2e-spec.ts`). `AuditLogModule` added to `CollectionIncentiveModule`'s own imports.
- Investigated the other two candidate modules under "Collections (calendar/incentive)" and confirmed neither needs instrumentation: `crm/collections-calendar` (`CollectionsCalendarController`) is a single read-only `GET` (day-grouped dues/reminders view) — no mutating actions to log. The top-level `calendar-events` module looked like a match by name but is tagged `Workspace · Calendar` — a generic shared company-calendar feature for the main dashboard widget, unrelated to CRM Collections — so left untouched, out of this scenario's scope.
- Full accumulated Scenario 29 regression, all 13 `accounting-audit-log-*.e2e-spec.ts` files plus the pre-existing Collections/Collector/Installment-Account suites, run together via `--runInBand`.

**Worth flagging:**

- **Closing Gap 4 (Credit & Collections) is now fully closed** — every mutating action across Credit Applications, Investigation, Promissory Note, Application Documents, Collector, Collector Remittance, Installment Accounts, and Collection Incentives writes a real before/after `AccountingAuditLog` entry.
- Remaining scenario scope: **Closing Gaps 5-7** (Inventory remainder, CRM beyond Credit & Collections, remaining POS admin) and **Closing Gaps 8-10** (OpenAPI regen, Recent Activity widget allowlist decisions, `AuditLogService`/`AccountingAuditLogService` unit tests) — none started yet.
