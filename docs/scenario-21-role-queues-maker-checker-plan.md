# Scenario 21 — Role-Based Action Queues, Maker-Checker & Approval Limits — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, row "18. Working from role queues and synchronizing audited transactions." New scenario, mapped from this row — doesn't fit any of Scenarios 01-14; it's a cross-cutting platform capability rather than a single business event.

**Scope note (developer-confirmed, 2026-07-31)**: this PDF row bundles four distinct capabilities. This one doc covers all four, but **offline sync (Closing Gap 5) is explicitly flagged as future work** needing its own separate scoping/design conversation before implementation — it should not block the other three, which are tractable, additive work on existing scaffolding.

## Related ClickUp Tickets

None found. Net-new scope.

## The scenario we're building toward

A user logs in, an approval/report is due, or connectivity returns:

1. The system shows a short role-based action queue.
2. The user acts only on permitted branch records.
3. Maker/Checker routes approvals while the system logs before/after, user, time, reason and approver.
4. The system labels allowed offline work Queued, Synced or Failed.
5. The system posts safe items on reconnect and routes customer/payment/serial conflicts.
6. Managers view dashboards generated from posted transactions.

**Result**: no silent edit or double posting occurs; current work, exceptions, audit trail and reports are visible by role.

## What's already done ✅

1. **Every module already has its own approve/reject flow with real RBAC gating.** PR/PO (`purchase-request.service.ts`, `purchase-order.service.ts`), transfers (two-stage manager→HQ, Scenario 06), POS void/cancellation/release-form/return-refund (`src/pos/*-requests.service.ts`).
2. **Maker/checker separation is implicitly enforced via RBAC** in most flows — approval permissions are typically held by a different role than the requester's, even though nothing explicitly checks it.
3. **A generic `UserAuditLog` already exists** (`src/audit-log/`) for auth/roles/permissions/users actions.
4. **POS checkout already has a real, narrow offline queue.** `navigator.onLine` + a `localStorage` queue, cash-only while offline, auto-syncs via `POST /pos/transactions/sync` → `transactions.service.ts`'s `syncOfflineTransactions()` (dedupes by `transactionNumber`, flags card/bank_transfer for manager review on reconnect). This is a real, working reference pattern for Closing Gap 5, not a gap itself.

## What's not done / gaps ❌⚠️

1. **No aggregated cross-module action queue.** Each module's approvals are siloed. The one dashboard widget that looks like this — `frontend/src/components/dashboard/widgets/PendingApprovalsWidget.tsx` — is fully hardcoded mock data (`APPROVALS` array), not wired to any API.
2. **No explicit maker≠checker enforcement anywhere.** E.g. `purchase-request.service.ts`'s `approve()` never checks `userId !== pr.requestedById` — relies entirely on the (unverified) assumption that approval permissions aren't held by the same person who typically requests.
3. **No real before/after structured audit trail outside POS transaction history.** `AccountingAuditLog` (with real `oldValues`/`newValues` Json fields, `schema.prisma:734`) exists but is dead code — zero writes anywhere. `UserAuditLog` (the one actually in use) has no before/after capture, just a generic `metadata` blob.
4. **No amount-based approval limits.** Explicitly out of scope per an existing code comment in `purchase-request.service.ts:15-18` — "Multi-tier approval (amount-based thresholds...) was scoped out of Phase 2."
5. **No real offline-first architecture beyond POS's narrow queue.** No IndexedDB, service worker, or PWA manifest anywhere in the frontend; no customer/payment/serial conflict routing beyond simple `transactionNumber` dedup.

## Closing the gaps

Ordered by risk/value.

### 1. Build a real aggregated action queue

**Problem**: `PendingApprovalsWidget.tsx` shows fake data; there's no single place to see what's pending across modules.
**Fix**: build an endpoint that pulls from each module's existing approval tables (PR, PO, transfers, POS release/void/return-refund) rather than inventing a new unified approval entity, and wire the existing widget to it.

### 2. Add explicit maker≠checker checks

**Problem**: the separation is assumed, not enforced.
**Fix**: confirm with the business which flows actually need a hard same-user block (some may be fine as-is if approval permission is tightly held), then add the check where it's missing.

### 3. Wire up or remove `AccountingAuditLog`

**Superseded 2026-08-17**: this item is now tracked and scoped in [Scenario 29 — Full Transaction Audit Log Coverage](./scenario-29-audit-log-coverage-plan.md) Closing Gap 2, alongside the rest of the app's untouched audit-log coverage. Developer-confirmed: wire it up for real (not remove). Not implemented yet in either doc.

### 4. Confirm whether amount-based approval limits are wanted now

**Problem**: this was previously explicitly deferred ("scoped out of Phase 2").
**Fix**: confirm with the business before building — this is a re-opening of a prior scope decision, not a fresh gap.

### 5. Offline sync — do not scope inside this implementation pass

**Problem**: true cross-module offline-first sync with conflict resolution ("customer/payment/serial conflicts") is a materially larger effort than the rest of this scenario.
**Fix**: flag for a dedicated technical/business conversation. The existing POS-only pattern (`localStorage` + reconnect sync + dedup) is a reasonable reference model to extend later, but should not block Closing Gaps 1-4.

## Dead code / unused-feature flags

- **`AccountingAuditLog`** — see Closing Gap 3 (wire up vs remove), not touched by this doc.
