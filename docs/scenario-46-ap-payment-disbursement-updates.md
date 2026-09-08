# Scenario 46 — AP Payment / Disbursement — Pending Updates

Companion to [scenario-46-ap-payment-disbursement-plan.md](./scenario-46-ap-payment-disbursement-plan.md). Holds newer client feedback and gaps found while building, not yet merged into that doc's gap analysis. Append-only, dated sections — never overwrite a prior entry.

---

## Update — 2026-09-08 (branch `fix/ap-withholding-not-paid`)

Source: working session with the developer on the withholding model, the voucher-before-payment flow, and the printed documents. Everything on that branch is **uncommitted** as of this entry.

### Parked — asked for, deliberately not started

1. **"Allow edit after payment is settled / allow override (owner)."**

   **The backend is already built.** `PATCH /ap-bills/:id/override` ([`ap-bills.controller.ts:367`](../../backend/src/accounting/ap-bills/ap-bills.controller.ts)) takes the same body as the ordinary edit and bypasses both the settled and the received locks. It is gated on `accounting:ap-bills:override`, which a Business Owner holds by bypassing permission checks entirely, and which is deliberately absent from every other role in `prisma/seed.ts`. `APBillsService.update()` takes the matching `override = true` argument. The normal `PATCH :id` keeps today's rules untouched, on purpose.

   **What is missing is the UI.** `APBills.updateWithOverride()` exists in `frontend/src/libs/data/AccountingV2Data.ts` and is **called from nowhere**. A Business Owner currently has no way to reach the route from the app.

   Open decisions before building:
   - Should an override write an audit entry? `AccountingAuditLogService` is already injected into this service. Editing a bill whose journal entry has posted is exactly what an auditor asks about, so this should probably be a yes, but it was never confirmed.
   - **Does override extend to vouchers?** Today it is bills only. `updateDisbursement()` still refuses anything that is not `UNPAID`, and a PAID voucher carries a journal entry — so a real edit there means reversing and reposting, not just relaxing a guard. `JournalPostingService.reverse()` exists. Treat vouchers as a separate piece of work.

2. **"Allow delete but needs approval."**

   **The backend is already built**, as Scenario 46 Part D. `POST :id/deletion-request` (needs `accounting:ap-bills:delete`), `POST :id/deletion-request/approve` and `POST :id/deletion-request/reject` (both need `accounting:ap-bills:approve`, which `prisma/seed.ts` keeps Business-Owner-only, so the same person cannot quietly request and approve). The `deletionRequestedAt / deletionRequestedById / deletionReason` columns exist on `ap_bills`.

   **Requesting has UI** — in `APBillsList.tsx` and `APBillDetail.tsx`. **Approving and rejecting do not.** `approveDeletion` and `rejectDeletion` are called from nowhere in the frontend, so a request can be raised today and then nothing can ever happen to it: it sets a timestamp and sits there.

   Open decision: where approvals live. Either buttons on the rows that already show the pending request (cheap, discoverable where the request is visible), or a dedicated _Pending approvals_ screen listing requests across all bills (more useful if requests are rare and reviewed in a batch). Not decided.

   Note the scope limit: this covers **bills**. Vouchers have no deletion-approval at all — only `cancelDisbursement()`, which refuses anything already paid.

### Data repairs outstanding on the dev database

3. **Three paid vouchers carry a ₱0 withholding claim** that should not be zero, caused by the settle bug fixed in this session (`settleDisbursement()` rebuilt the voucher through `createDisbursement()` and copied only `apBillId` and `amount`, so the claim was dropped the moment a voucher was paid):

   | Voucher          | Invoice             | Invoice withheld | Claim now |
   | ---------------- | ------------------- | ---------------- | --------- |
   | `PV-202609-0003` | `SI-TEST-02-SEPT-8` | ₱100             | ₱0        |
   | `PV-202609-0004` | `SI-SEPT-8`         | ₱300             | ₱0        |
   | `PV-202609-0005` | `SI-SEPT-8`         | ₱300             | ₱0        |

   Correcting these posts nothing — the withholding was reclassified out of AP at receipt and does not move. The claim only decides which voucher documents it. The developer has not yet given the figures each should carry.

4. **`PV-202609-0001` is a stray unpaid voucher** raised while verifying the voucher-before-payment flow. It has no sources and no journal entry. Offered for deletion or cancellation several times; never actioned.

### Gaps found while building, not addressed

5. **There is no AP-side BIR 2307 anywhere in the system.** The only 2307 machinery is on the AR side — customers withholding from NIG, with certificate numbers and a pending-2307 aging report. This matters because the per-voucher withholding claim was justified on "it decides which 2307 the supplier receives", and nothing currently consumes that answer. If NIG physically issues a 2307 per cheque, that is a real feature and the claim becomes load-bearing; if they issue one per invoice or per period, the claim is presentation only.

6. **Withholding on the voucher could be derived rather than typed.** Considered and deliberately not taken this session. The rule would be: a voucher that clears the invoice's whole remaining balance carries the unclaimed withholding and prints the `Total / Less / Net` block; a part payment carries none and prints a context line instead. Agreed it is a simplification, not a fix — the double-count it would prevent is already prevented by the allocation cap. Revisit only if the typed field proves error-prone in use.

7. **A part payment's printed voucher has no invoice context.** Under the current rules a part payment can print `Total / Less / Net` using its own claim, which reconciles, so this is not urgent. The sketched alternative was a subline reading `Invoice ₱4,500.00 · withheld ₱300.00 · ₱200.00 after this`. Not on the client's paper template, so it was never confirmed.

8. **Five printed documents still use the old fluid layout.** The sheet model (real `@page` size, margins, a WYSIWYG preview, Print + Download) was applied to the AP payment voucher, the expense voucher, the Purchase Invoice, the Receiving Report and the Purchase Order. Still unconverted: **Collection Receipt** (the AR-side twin of the payment voucher — it will look visibly inconsistent beside it), Stock Transfer, AR Invoice, Customer Ledger, and the Aging Report (which already had its own `@page { size: landscape }`).

9. **Downloading a printed document produces `.html`, not PDF.** There is no PDF library in the app. The print dialog's "Save as PDF" now yields an exact PDF because the pages carry real `@page` dimensions, so this was left alone. A true one-click PDF needs either a client-side library (rasterised, worse output) or server-side rendering (a real dependency, with deployment implications).

10. **The bank account dropdown renders `N/A - BDO - Goldenfield (Peso)`** when a bank account's `accountNumber` is the literal string `N/A`. Cosmetic, one line, repeatedly offered and never taken.

11. **There is no pending-voucher worklist.** An unpaid voucher is reachable only through one of its invoices. Anyone wanting "what have we raised but not paid?" has to go invoice by invoice. The Payments screen is PAID-only by design, at the client's explicit request.

### Not ours — flagged only

12. **A Scenario 47 "installment single AR" work-in-progress is in the same working tree** (`installmentScheduleLine` → `installmentScheduleLines[]`, `arInvoiceId` no longer unique, plus migration `20260907210000_scenario_47_installment_single_ar`, which `prisma migrate deploy` applied to the dev database alongside this branch's own). It accounts for **all** remaining backend typecheck errors, every one of them in `src/accounting/ar-invoices` or `src/crm`. Nothing in this branch touches those files. See [scenario-47-installment-single-ar-plan.md](./scenario-47-installment-single-ar-plan.md).

13. **The Poppins font migration** in `src/app/globals.css` and `src/app/layout.tsx` is not part of this branch's work either, though it is in the same working tree.
