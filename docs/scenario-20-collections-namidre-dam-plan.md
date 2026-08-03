# Scenario 20 — Collections Reminder Track (NAMIDRe) & Delinquency Escalation (DAM) — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, rows "16. Performing NAMIDRe reminders and follow-up" + "17. Managing a DAM account and escalating it for legal action." New scenario, combining both rows into one doc (developer-confirmed, 2026-07-31) since the PDF describes NAMIDRe and DAM as two mutually-exclusive stages of one continuous pipeline ("NAMIDRe and DAM do not run at the same time").

**Relationship to Scenario 11**: builds directly on Scenario 11's Collections module (`Collector`, `InstallmentAccount`, category/classification A/B/C/D, `CollectorRemittance`, early payoff — verified substantially implemented). Read that scenario's plan doc first. "NAMIDRe" and "DAM" appear to be NIG-internal terms — NAMIDRe likely an early/soft reminder track, DAM likely a formal delinquency-management track — neither term nor concept currently exists in code; don't assume the meaning beyond what the PDF states.

## Related ClickUp Tickets

None found. Net-new scope.

## The scenario we're building toward

**NAMIDRe** — a first-three-month due/reminder task appears and the account is not in DAM:

1. ERP creates the task and suppresses duplicates.
2. Branch NAMIDRe User/Cashier calls or messages using a dedicated phone and logs outcome/proof.
3. Collector handles a home-collection referral.
4. Branch Manager reviews missed or escalated tasks.
5. ERP closes the task when payment posts.

**DAM** — an account meets the DAM rule or an authorized high-risk trigger:

1. ERP moves the account out of NAMIDRe into DAM and assigns the Collector.
2. Collector logs structured outcomes, PTP, visits and evidence.
3. BM and Area Supervisor review next action and completeness.
4. HO AR monitors and approves escalation; B-to-C requires exhausted BM-Collector-AS actions.
5. ERP checks the Small Claims pack and tracks SOA/demand-letter service.

**Result**: early reminders have an auditable outcome, owner and next action; a chronological recovery/legal file shows owner, next action, NIG category and Small Claims readiness.

## What's already done ✅

1. **A real category/classification foundation exists.** `InstallmentAccountCategory` (A/B/C/D) and `InstallmentAccountClassification` (official/arrears/not_moving) (`backend/prisma/schema.prisma:1936-1947`), plus `CategoryGraduationRequest` as an approval-gated category-change mechanism — a strong pattern to reuse for a "graduate into a more severe track" concept, just not wired to NAMIDRe/DAM specifically today.
2. **A generic `Reminder` model + service + "Due Today" UI already exists.** `schema.prisma:3874` (enums `ReminderType`/`ReminderStatus` at `:3721`/`:3728`), `src/crm/reminder/`, `frontend/.../crm/reminders/_components/RemindersList.tsx:324` — but linked only to `Customer`/`Lead` generically, not `InstallmentAccount`/`Collector`.
3. **A generic `Interaction` model exists** with `interactionType` including `visit`/`call` and a free-text `outcome` field (`schema.prisma` ~3835) — again linked only to `Customer`/`Lead`.
4. **`Collector` + `CollectorRemittance` (Scenario 11) already give a real per-account collector assignment and remittance-posting mechanism** to build "assigned Collector" and "closes when payment posts" on top of.

## What's not done / gaps ❌⚠️

1. **The literal "NAMIDRe" and "DAM" concepts don't exist anywhere** — zero matches for either term in either repo.
2. **`Reminder`/`Interaction` aren't linked to `InstallmentAccount` or `Collector` at all** — only to `Customer`/`Lead` — so neither can currently express "this account's early-reminder task."
3. **No duplicate-task suppression, dedicated phone-channel field, or auto-close-on-payment hook** on `Reminder`.
4. **No structured Promise-to-Pay (PTP) tracking.** `Interaction.outcome` is free text, not a structured PTP-with-committed-date field.
5. **No two-track bifurcation.** The existing category/classification ladder is a single continuous scale — not two distinct stages (soft NAMIDRe vs formal DAM) with a hard boundary, different actors, different contact channels, and different gate logic.
6. **No legal-escalation pipeline at all.** No Small Claims pack, no SOA/demand-letter tracking, no "recovery/legal file" concept anywhere.

## Closing the gaps

Ordered by risk/value.

### 1. Confirm the NAMIDRe → DAM trigger rule

**Problem**: the PDF says "DAM rule or an authorized high-risk trigger" without defining either.
**Fix**: this is a product/policy decision, not an engineering one — confirm the exact trigger conditions with the business before building the state transition.

### 2. Repurpose `Reminder`/`Interaction` as the NAMIDRe track

**Problem**: building a parallel reminder system from scratch would duplicate a shape that's already close.
**Fix**: link `Reminder`/`Interaction` to `InstallmentAccount`/`Collector`, add duplicate-suppression, a dedicated phone-channel field, and a payment-posted hook to auto-close — rather than a new model.

### 3. Add structured PTP tracking

**Problem**: a "promise to pay" today is indistinguishable from any other free-text outcome note.
**Fix**: add a PTP entity (or structured fields on `Interaction`) with a committed date, distinct from a generic outcome.

### 4. Add the DAM stage as a formal state

**Problem**: no formal delinquency-management stage exists with its own review chain.
**Fix**: add DAM as a formal state on `InstallmentAccount` (or a new linked entity) with assignment/review chain (Collector → BM → Area Supervisor → HO AR), reusing `CategoryGraduationRequest`'s approval-gate pattern.

### 5. Scope legal escalation as a later phase

**Problem**: "Small Claims pack" and demand-letter tracking imply real legal documents, which may need legal-team input beyond engineering scope.
**Fix**: confirm with the business whether this needs real document generation/tracking or just a checklist/status field for now — don't build document generation on spec.

## Dead code / unused-feature flags

None found.

## Implementation Log — 2026-08-03

**For this scenario, I have done:** closed gap #2 ("Repurpose `Reminder`/`Interaction` as the NAMIDRe track") in full — all three of its named sub-items. Scope for this pass, confirmed with the developer up front: NAMIDRe reminder track only. Structured PTP tracking (gap #3), the DAM formal state (gap #4), and legal escalation (gap #5) are explicitly **not** touched — see "Worth flagging." Reminders also stay manually created this pass — no auto-scheduling off NAMIDRe's "first-three-month due" timing rule.

- **Linked `Reminder`/`Interaction` to `InstallmentAccount`/`Collector`.** Both models gained optional `installmentAccountId`/`collectorId` FKs (`ON DELETE SET NULL`) alongside the existing `customerId`/`leadId`, plus a dedicated `contactPhone` field on both (migration `20260803031913_link_reminder_interaction_to_collections`). `complete()` on a reminder now accepts `{outcome, contactPhone}` and carries both onto the auto-logged interaction — previously it set no outcome at all, generic or otherwise, regardless of relation type. New frontend surface: a "Collections reminders" section on the `InstallmentAccountDetail` page (schedule/list/complete), reusing the existing `ScheduleReminderModal` via a widened target union rather than a new component. Along the way, fixed a real pre-existing a11y gap in that modal — its labels had no `htmlFor`/`id` association, unlike every other form in this codebase — needed to make it actually testable via `getByLabel`/`getByRole`, and a genuine screen-reader fix regardless.
- **Duplicate-task suppression**, confirmed with the developer (the PDF's "suppresses duplicates" doesn't define what a duplicate is): one open (`pending`/`overdue`) reminder per installment account at a time, scoped to the collections path only — pre-existing customer/lead reminders are unaffected. Enforced as a `409 duplicate_open_reminder_for_account` on `create()`, surfaced in the Schedule modal as an inline error ("This account already has an open reminder. Complete it before scheduling a new one.") rather than silently returning the existing reminder — nothing typed is lost, the modal just stays open.
- **Auto-close-on-payment**, matching the PDF's step 5 ("ERP closes the task when payment posts") literally: both `recordPayment()` and `earlyPayoff()` on `InstallmentAccountService` now auto-complete any open reminder(s) on that account via `ReminderService.complete()`, logging an outcome like `"Auto-closed — payment posted (₱1000, OR E2E-PAY-1)"` on the auto-logged interaction. Required wiring `ReminderModule` into `InstallmentAccountModule` (one-directional import, no cycle). Also fixed `RecordPaymentModal`/`EarlyPayoffModal` on the frontend, which only refreshed the account balance on success, not the reminders list — without this, the UI would've shown a stale "open" reminder until a manual page reload, undercutting the whole point of the feature.
- **Found and fixed while manually verifying this in the browser**: the auto-close outcome text used `dto.orNumber ?? 'n/a'`, which doesn't catch an empty-string OR number (the form's default), producing `"...OR )"` instead of the intended `"...OR n/a)"`. Switched to `||`. Minor, but this text becomes a permanent interaction/audit record.

**Worth flagging:**

- **Deferred, not forgotten**: structured PTP tracking (gap #3), the DAM formal state + review chain (gap #4), and legal escalation (gap #5) are all still open, per this doc's own "Closing the gaps" section above. None were in scope for this pass.
- **Same pre-existing RBAC gap already noted for Collector/InstallmentAccount controllers (Scenario 11) also applies here**: `ReminderController`/`InteractionController` have no `PermissionsGuard`/`@RequirePermissions` at all, just `@UseGuards(JwtAuthGuard)` — any authenticated user can create/complete/delete any reminder or interaction, regardless of role. Not introduced by this pass, but now more relevant since this data includes collections contact logs.
- **The pre-existing global `/crm/reminders` page (`RemindersList.tsx`) is untouched** and will already list NAMIDRe reminders (it doesn't filter by relation type), but without any installment-account context — no account number, no "this is a collections task" indicator. Surfaced during manual testing as a real point of confusion (a NAMIDRe reminder and a generic customer reminder look identical there). Worth a small follow-up — out of scope for this pass since it wasn't part of the confirmed 3-part breakdown.
- New coverage: backend e2e `test/crm-reminders-interactions-namidre.e2e-spec.ts`, 16/16 passing (linkage, duplicate-suppression, auto-close). Frontend e2e, 4 new tests in `crm-collectors-installment-accounts.spec.ts` (schedule+complete, duplicate-block, payment-auto-close), 12/12 in that file passing (one unrelated pre-existing test confirmed flaky/cold-compile-race, not a regression — passes in isolation). All three parts also manually verified twice: once via a scripted browser walkthrough with screenshots, once live by the developer on a fresh account they created themselves.

## Implementation Log — 2026-08-03 (DAM)

**Doc drift correction**: the entry above says gaps #3, #4, and #5 "are all still open." All three are now closed by this pass — see below. This entry closes out every remaining item in this doc's "Closing the gaps" section; Scenario 20 (NAMIDRe + DAM) is fully implemented as scoped.

**For this scenario, I have done:**

- **Gap #1 (NAMIDRe → DAM trigger rule) + gap #4 (DAM as a formal state), confirmed with the developer via two explicit questions rather than assumed:** the automatic trigger is `classification` transitioning to `not_moving` (reusing the existing classification field rather than inventing a new threshold); a manual "authorized high-risk trigger" override also exists, approval-gated. `InstallmentAccount` gained `inDam`/`damEnteredAt`; setting classification to `not_moving` via the normal update endpoint auto-transitions the account (no extra approval on that path — assigning that classification already represents a real judgment call). New `DamEscalationRequest` model + request/approve/reject flow mirrors `CategoryGraduationRequest` almost exactly, gated behind a new `approve_dam_escalation` permission. Frontend: a red "DAM" badge in the account header, a "DAM entered" date under Collection tags, and a request/pending-approval card mirroring the existing graduation-request UI.
  - **Two real bugs caught by the manual browser walkthrough, neither would have been caught by the backend e2e suite** (its cleanup bypasses the API layer via direct Prisma calls): (1) my first backend test run crashed inside `afterAll` (missing `damEscalationRequest` cleanup before deleting accounts) — fixed, but that crash had also skipped the rest of that `afterAll`, leaking 12 accounts/3 collectors/1 customer/2 AR invoices into the dev DB, one of which coincidentally matched a peso value another test asserted on and broke it; all found and cleaned up. (2) `InstallmentAccountService.remove()` never cascaded `DamEscalationRequest` rows — deleting an account with any DAM escalation history threw an FK error; fixed, plus a dedicated regression test added.
- **Gap #3 (structured PTP tracking):** `Interaction` gained `isPromiseToPay`/`ptpAmount`/`ptpDate`, distinct from the free-text `outcome` field. A PTP without a committed date is rejected (`ptp_date_required`) — enforced on both `POST /crm/interactions` and `reminder.complete()` (so completing a NAMIDRe/DAM task with a PTP flows the same way outcome/contactPhone already did). Frontend: `CompleteReminderModal` gained a "Mark as Promise to Pay" checkbox revealing Amount + Date fields, same date-required rule enforced client-side first.
- **Gap #5 (legal escalation), confirmed with the developer earlier in this same session as "checklist/status field only" — no document generation:** new `legalEscalationStatus` enum (`none → soa_prepared → demand_letter_sent → small_claims_pack_ready → filed`) + a notes field + audit fields (`legalEscalationUpdatedAt`/`legalEscalationUpdatedById`) on `InstallmentAccount`. Dedicated `PATCH /crm/installment-accounts/:id/legal-escalation` endpoint behind its own `manage_legal_escalation` permission (separate from general edit, matching the DAM-escalation precedent); guarded so it only applies once an account is already in DAM (`account_not_in_dam` otherwise). Frontend: a "Legal escalation" section on the detail page, rendered only when `account.inDam` is true.

**Worth flagging:**

- **Deliberately not built**: the PDF's steps 3–4 ("BM and Area Supervisor review next action and completeness"; "HO AR monitors and approves escalation; B-to-C requires exhausted BM-Collector-AS actions") describe a multi-stage review chain. This pass builds the DAM _entry_ gate (trigger + manual override) and a legal-escalation _status field_, but not a formal BM → AS → HO AR review workflow with its own approval stages — that would be a materially bigger lift (new roles/permissions per stage, a review-queue UI) and wasn't part of what was scoped as "checklist/status field only." If the business needs that full chain enforced in software (vs. tracked informally via the status/notes fields), it's a follow-up scope conversation, not something to build on spec.
- **Same pre-existing RBAC gap**: still applies (see the NAMIDRe entry above) — not touched by this pass either.
- New coverage: backend e2e — 6 new tests for DAM trigger/escalation (auto-transition, no-reset-on-repeat, no-fire-on-other-values, request/approve, request/reject, inDam filter) + 1 delete-cascade regression test, 53/53 passing in `crm-collectors-installment-accounts.e2e-spec.ts`; 6 new PTP tests, 22/22 passing in `crm-reminders-interactions-namidre.e2e-spec.ts`; 3 new legal-escalation tests, included in the same 53. Frontend e2e — 3 new tests (DAM UI, PTP capture with client-side validation, legal escalation section visibility + update), 14/14 passing, no regressions. All three parts manually verified twice over: once via scripted browser walkthroughs with screenshots, once live by the developer clicking through every step themselves on fresh accounts they created.
