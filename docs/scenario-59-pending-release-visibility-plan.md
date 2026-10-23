# Scenario 59 — Pending Release Approval Visible Where the Cashier Is Looking — Gap Analysis & Closing Plan

**Source**: the client's POS checklist relayed 2026-09-21, "In POS, we should have" section, one line:

> - "Pending release approval" visible in transaction

The last remaining item on that checklist that is both un-started and not blocked on someone else's answer. Everything else outstanding needs a schema decision (agent vs. in-office), a business rule (eligible for rebate), a pointer from the client (down-payment comment text, which "New Sale"), belongs to Scenario 56 (Margin in the Excel workbook), or is waiting on Ms. Sam (collection receipt fields).

## What actually creates a pending request — corrected 2026-09-21

Worth stating first, because an earlier draft of this doc got it wrong and the backend's own docstring still said the old thing (corrected in this scenario).

**It is installment lines, not serialized items.** `TransactionsController` defers to approval on `hasInstallmentLine` alone — in-house and TPF alike. The comment above that check records why: _"serial hold is deliberately gone: it sent nearly every appliance sale to a manager, which is the checkout friction the client asked to remove."_ A serialized **cash** sale now posts directly, and a charge/installment sale can reach approval with zero serial-tracked lines.

**And not always for a cashier.** A submitter already holding `pos:transaction:override` skips the detour entirely and posts directly — they would otherwise be approving their own request. So **a Business Owner's installment sale never produces a pending row at all**, and the banner is in practice a cashier-and-branch-manager-without-override surface.

This does not change what the banner reads (it renders whatever `/own` returns as `pending`), but it determines how the feature is tested, and it is why the automated coverage below is limited to the negative case.

## The wording cannot be taken literally

`PosReleaseFormRequest.createdTransactionId` is a unique FK to `PosTransaction`, and it is only set **when the request is approved and the transaction is created**. While a request is pending there is no transaction row at all — so there is nothing to display a "pending" status _on_.

What the client is describing is the cashier's experience, not the data model: a cashier rings up an installment sale, it goes for manager review, and then it **disappears**. It is not in the transactions list, and nothing on screen explains where it went or that it is waiting on someone.

## What's already done ✅

Verified against `development` on 2026-09-21 — and this is more than the checklist line implies:

- **The endpoint exists and a cashier can call it.** `GET /pos/release-form-requests/own` is gated on `pos:transactions:read`, which Cashier holds. Its own Swagger summary says it plainly: _"Cashier fetches their own submitted release form requests (any status) — read-only status visibility, no approval capability"_. `getOwnRequests()` returns status, session, branch, held serials, promissory notes, and `createdTransaction.transactionNumber` once approved.
- **The server action exists.** `getOwnReleaseFormRequests()` in `pos-actions.ts:2737`, cache-tagged.
- **A page already renders it.** `/pos/release-approvals` is gated on `pos:transactions:read` (not the manager's `pos:transaction:override`), and `ReleaseApprovalsList` already calls `getOwnReleaseFormRequests()` when `isManager` is false. A cashier who navigates there today sees their own pending requests.

So the capability is built, permissioned correctly, and working. Nothing needs to be created.

## What's not done / gaps ❌

1. **Nothing surfaces it where the cashier actually is.** ❌
   After completing a sale that needs release approval, the cashier is on checkout or `/pos/transactions`. The sale is absent from the transactions list — correctly, since no transaction exists yet — and neither screen mentions that anything is pending or links to the page that would show it. The cashier has to already know `/pos/release-approvals` exists and think to go there.

## Decision taken

**A banner on the transactions list, not rows in the table** (developer decision, 2026-09-21). A pending request has no transaction number and no settled total, so as a table row several columns are necessarily blank, and it reads as a broken transaction rather than a sale in flight. A count plus a link is honest about what these are — _not yet transactions_ — and points at the surface that already renders them properly.

## Conventions this scenario must follow

- **Role access hierarchy** — no new permission is introduced; the banner reuses `pos:transactions:read`, which Business Owner and Branch Manager also hold, so it renders for them too. That is correct: a manager on the transactions page has the same reason to know something is waiting.
- **Branch data scoping** — not applicable. `getOwnRequests()` filters by `requestedById`, i.e. the caller's own requests only, which is narrower than branch scoping already.

## Closing the gaps — proposed parts

### Part 1 — Pending-release banner on the transactions list

Frontend only. Call the existing `getOwnReleaseFormRequests()` from the transactions view, count those with `status === 'pending'`, and render a banner linking to `/pos/release-approvals` when the count is above zero. No banner when there are none.

No backend change, no new permission, no migration.

## Manual testing

Must be run as a **cashier**. As Business Owner the banner can never appear, because `canSelfApprove` posts their installment sale directly.

1. Sign in as `technova.b25.cashier@test.com` (Barotac Nuevo).
2. Ring up an **installment** sale — a serialized cash sale will simply complete and is no longer held.
3. On submit, expect the pending-approval screen rather than a completed sale.
4. Go to `/pos/transactions` — the amber banner should read **"1 sale waiting on manager release approval. It is not listed below until approved."** with a **View** button.
5. Click **View** — lands on `/pos/release-approvals` showing that request.
6. Approve it as `technova.owner@test.com`, then reload `/pos/transactions` — banner gone, sale now in the table.

Steps 4 and 6 are the feature: it appears when something is pending and disappears when nothing is.

Prerequisite worth knowing: an installment sale requires an approved credit application, and this project's seed does not reliably populate `customers` or `agents`, so those may need creating first.

## Open questions

None. The placement decision is taken, the endpoint exists, and the permission is already correct.

## Related ClickUp Tickets

None identified yet — to be matched before Phase 7.

## Implementation Log — 2026-09-21

**For this scenario, I have done:**

- **Part 1 (gap 1) — pending-release banner on the transactions list.** `TransactionsList` now calls the existing `getOwnReleaseFormRequests()`, counts `status === 'pending'`, and shows an amber banner linking to `/pos/release-approvals` when the count is above zero. Frontend only — no backend change, no new permission, no migration. The copy states _why_ they are absent ("not listed below until approved"), which is the actual confusion; the fetch failure is swallowed deliberately, since a pointer to another page must never take the transactions list down with it.

**Also fixed this run, found during manual testing:**

- **`TransactionDetail`'s "View customer ledger" 403'd for a cashier.** It hardcoded `/crm/customers/…/ledger`. The customer-view parity work added `/pos/customers/:id/ledger` and repointed `Customer360`'s links, but this component — a different one — was never touched. The destination is now resolved from the session (`canAccessModule(session, 'crm')`) rather than a scope prop, because the modal is opened from three places (CRM's `Customer360`, the POS dashboard, and the POS transactions list) and sending the viewer wherever they can actually open is correct in all three with no call-site change. Audited the rest: `InstallmentLedgerView`'s "Full account details" also hardcodes a CRM route, but that component is only rendered from CRM and Accounting pages, never POS, so it was left alone.

**Worth flagging:**

- **The trigger for a release request had changed, and the backend's own docstring still described the old one.** `ReleaseFormRequestsService.submit()` said _"Cashier submits a serialized sale for manager approval"_; the rule is now `hasInstallmentLine` alone (in-house and TPF), with the serial hold deliberately removed because it sent nearly every appliance sale to a manager. That stale comment was load-bearing — an earlier draft of this doc and a first set of manual test steps were both built on it. Corrected in this scenario, along with the undocumented `canSelfApprove` exception.
- **The populated banner state cannot be covered by Playwright here**, and not merely for want of fixtures: the suite runs as Business Owner, who holds `pos:transaction:override` and therefore never produces a pending row. Automated coverage is the negative case (no banner, and never a "0 sales waiting" one) plus reachability of both linked destinations; the populated path is the manual steps above, confirmed by the developer this run.
- **Nothing needed building on the data side.** `GET /pos/release-form-requests/own` was already gated on `pos:transactions:read`, the server action already existed, and `/pos/release-approvals` already rendered it for non-managers. The entire gap was that nothing told the cashier to look.
