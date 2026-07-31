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
