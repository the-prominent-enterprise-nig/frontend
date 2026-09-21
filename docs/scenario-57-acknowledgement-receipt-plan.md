# Scenario 57 — Acknowledgement Receipt for Non-Customer Collections — Gap Analysis & Closing Plan

Source: developer-scoped, live in chat 2026-09-21, no client ticket yet. Original ask: "Collections: Acknowledgement Receipts for non customer payments / payments... Receive the money then they will issue an acknowledgement receipt or collection receipt." The original ask also paired this with "Payment of retention" — the developer explicitly dropped retention from this scenario's scope the same session (see Decisions). Planning only — nothing implemented yet.

## Related ClickUp Tickets

None identified or linked yet. Per house rule, no ticket gets created, moved, or touched without an explicit go-ahead.

## The scenario we're building toward

Money that comes into Collections isn't always tied to a Customer or an open `ARInvoice` — e.g. a walk-in miscellaneous payment, a refund, or any other inbound payment the client wants formally receipted, but that today's Collection Receipt has no path to record. The client's description implies a fork at the moment money is received: staff decide whether to issue a **Collection Receipt** (a customer and invoice already exist) or an **Acknowledgement Receipt** (they don't). This scenario builds the second path only — the first (Collection Receipt) already exists and stays untouched.

## What's already done ✅ (verified this session, file/line cited)

1. **Collection Receipt's infrastructure is a directly reusable template.** The branded print-document family (`frontend/src/libs/print/printInventoryDocument.ts`, e.g. `buildARInvoiceHtml`/`buildAPBillHtml`), a real full-page create pattern (`receipts/new/page.tsx` + `NewReceiptForm.tsx` — explicitly built as "a real, dedicated 'New Receipt' page (not a modal)" per Scenario 44), and `JournalPostingService`/`MAPPING_KEYS` as the generic GL posting mechanism all already exist and need only be pointed at a new document type, not rebuilt.
2. **A working precedent for "money received now, not tied to a specific invoice yet" already exists.** `UnappliedCustomerCollection` (`schema.prisma:1319-1353`, `backend/src/accounting/unapplied-collections/unapplied-collections.service.ts`) posts Dr Cash / Cr a holding GL account from just `amount`, `paymentMethod`, `reference`, `notes` — no invoice required at the point of recording. It's still customer-bound today, but its posting shape (credit a suspense/holding account instead of AR) is exactly the shape this scenario needs.
3. **The app already tolerates "no linked party record, just a name" — on the money-out side.** `BusinessExpense` (`schema.prisma:1874-1963`) has a `payeeType` plus a free-text `payee` fallback (line ~1922-1923) for when there's no linked Customer/Supplier/Employee row. Proof the pattern this scenario needs (a party captured as text, not a foreign key) is already established elsewhere in the app, just not yet on the money-in side.

## What's not done / gaps ❌

1. **No non-customer collection path exists anywhere.** `CollectionReceipt.customerId` is a required, non-nullable FK (`schema.prisma:960-1020`); every payment-recording route (`POST /ar-invoices/:id/payments`, `POST /ar-invoices/bulk-payments`) requires an existing `ARInvoice`, and `recordPaymentCore()` derives the customer from that invoice (`backend/src/accounting/ar-invoices/ar-invoices.service.ts`, ~1766-1870). There is no endpoint or screen that accepts money without a known customer and invoice.
2. **No document type or model for "Acknowledgement Receipt" exists.** Confirmed no model, enum, or UI screen anywhere by this name. The only existing use of "acknowledg(e)ment" in the app is unrelated: a signature line printed on AP/Expense payment _vouchers_ — "Acknowledged receipt of payment from {enterprise}" (`printInventoryDocument.ts`, `buildAPPaymentVoucherHtml`/`buildExpenseVoucherHtml`) — the _supplier_ acknowledging _NIG's outbound_ payment, the opposite direction and a different document from what we're building here. Worth a visually distinct label so staff don't conflate the two.
3. **No generic "who paid us, unlinked to any record" field exists on the money-in side.** The one model that looks like it might fit — `Payment` (`schema.prisma:791-804`, has a bare `payer` string) — is confirmed dead code, zero references anywhere in `src/`. Don't build on it; its name would also collide if reused.
4. **No GL mapping key exists for a generic non-customer collection.** `UnappliedCustomerCollection`'s `UNAPPLIED_CUSTOMER_COLLECTIONS` key is the closest pattern but is wired specifically to `Customer`.

## Decisions (developer, 2026-09-21)

1. **Acknowledgement Receipt is a separate flow, not a variant of the existing "New Receipt" form.** Mirrors Scenario 46's own AP-vs-Expenses split (Decision 6: two separate doors for two separate transaction shapes) rather than adding an optional "no customer" toggle onto Collection Receipt's existing form.
2. **Full page, not a modal**, for the create screen — matching the precedent Collection Receipt itself just set (Scenario 44).
3. **"Who paid" is free text only.** No search or link to an existing Customer/Supplier/Employee record — closer to a digitized paper receipt book than a linked transaction. No party record is created or matched behind the scenes.
4. **Retention explicitly dropped from this scenario's scope.** The original ask paired "Acknowledgement Receipts for non-customer payments" with "Payment of retention" — the developer removed the retention half this session. (Unrelated aside for context only: there is a separate, already-shelved "Customer Retention" concept from Scenario 38 Gap 9 — invoice-side withholding released later, not a cash receipt — that has no bearing on this decision and was not what was being asked about here.)

## Open questions (not yet answered)

1. **Reason field** — free text, or a light dropdown (e.g. Refund Received / Reimbursement / Miscellaneous / Other)? Affects how reportable these receipts are later.
2. **Findability after creation** — is print-and-file sufficient, or does the list need to be searchable/filterable (e.g. by payer name, date, amount)? A list + detail page is planned either way (mirroring Collection Receipt's own), but search/filter scope isn't confirmed.
3. **Document number prefix** — proposed `ACK-YYYYMMDD-NNNN` (distinct from Collection Receipt's `CR-...`, and deliberately avoiding an `AR-` prefix since that already means Accounts Receivable everywhere else in this app) — needs confirmation, ideally against the client's own paper form if one exists.
4. **GL treatment** — proposed Dr Cash-or-Bank / Cr a new suspense/liability holding account, following the `UnappliedCustomerCollection`/`CustomerAdvance` pattern (money in now, classified later, nothing forced onto AR). Per Scenario 49, this project no longer invents GL accounts — is there an existing client chart-of-accounts line this should map to, or does a new one need to be requested from the client?
5. **Entry-point placement** — does Acknowledgement Receipt get its own sidebar/nav item under Collections, or a second button next to Collection Receipt's existing "New Receipt"? Affects discoverability, not the underlying logic.

## Closing the gaps (proposed, pending answers above)

- **A. New model + endpoint.** A new table (e.g. `AcknowledgementReceipt`) carrying `payerName` (free text), `reason`, `amount`, `paymentDate`, `method`, `bankAccountId`/`reference`, `notes`, `branchId`, `collectorId`, a system-generated `number`, `journalEntryId`, `cancelledAt`/`cancelReason` — mirroring `CollectionReceipt`'s own shape minus every customer/invoice field. One new endpoint to create it, posting Dr Cash-or-Bank / Cr the new holding account via `JournalPostingService`.
- **B. New full page + list/detail.** A "New Acknowledgement Receipt" page (free-text payer, reason, amount, date, method, notes) plus a list and a detail/print view — same shape as Collection Receipt's own `receipts/new` / `receipts/view`.
- **C. New print document.** A new builder in `printInventoryDocument.ts`'s branded family, visually distinct from the existing AP/Expense voucher's "Acknowledged receipt of payment" signature line.

## Not in scope for this doc

- **Retention** — neither the client's original "payment of retention" framing nor the pre-existing, unrelated, shelved Scenario 38 Gap 9 concept. Explicitly removed from this scenario by developer decision, 2026-09-21.
- Linking a payer to any existing Customer/Supplier/Employee record — decided against; free text only.
- Undeposited Funds routing / branch-specific holding accounts — an already-known, separately deferred gap (Scenario 44 Decisions 4-5). This doc's proposed holding account follows the same simple pattern without resolving that broader question.
