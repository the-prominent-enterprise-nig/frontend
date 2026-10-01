# Scenario 60 — Employee Appliance Loan in POS Checkout — Gap Analysis & Closing Plan

**Source**: developer request, 2026-09-26, discussed live before any code was written. Not sourced from a client document — goal statement from the developer: "Should be in POS in the checkout. Same flow BUT in the checkout, identify that the person is an employee — no credit application needed, in-house financing with no down payment / TPF / credit card, plus a field called 'HR appliance loan application number'."

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill once this doc is confirmed.

## The scenario we're building toward

A cashier is checking out a cart for a customer who happens to be an employee, buying an appliance through the normal POS cart (not a separate screen):

1. Cashier selects the customer as normal. If that customer is tagged `customerType: employee`, checkout shows a small badge next to their name.
2. A new checkbox appears once a customer is selected: **"Employee Appliance Loan (no down payment, no credit application required)"**. It auto-checks itself when the selected customer is employee-tagged, but the cashier can uncheck it — this is a cashier-confirmed action, not a silent behavior change driven purely by customer data.
3. With it checked, the rest of checkout stays exactly as it is today — same Payment Mode options (Cash / Installment / Debit-Credit Card), same per-line financing provider toggle (In-house / TPF) — **except**:
   - Down payment on any installment line (in-house or TPF) is forced to ₱0 and locked, instead of the usual 10%-of-line-amount minimum.
   - The "Approved Credit Application" selector and the "Raise one for this cart" button are hidden entirely, the same way they already disappear for a government institutional customer today.
   - A new required field appears: **"HR Appliance Loan Application Number"** (free text), styled and gated like the existing TPF reference number field — required before Confirm whenever the checkbox is active.
4. Confirm posts the sale through the existing installment machinery, just with a ₱0 down payment and the new number attached to the transaction.

**Explicitly not part of this**: no new financing computation engine, no new GL treatment, no restriction of which Payment Mode options are shown (that was considered and rejected — see Decisions below).

## What's already done ✅

1. **The customer-side "employee" tag already exists.** `Customer.customerType === 'employee'` (`backend/prisma/schema.prisma:6567-6571, 6658`) plus a free-text `Customer.employeeNumber` (`schema.prisma:6661`, no FK to the real HR `Employee` table). Captured today only at customer-creation time via `frontend/src/components/crm/CustomerExtraFields.tsx:234-244` — checkout itself never reads or shows it.
2. **A real, unrelated HR `Employee` table also exists** (`schema.prisma:148-202`), used by `EmployeeCashLoan`'s dedicated employee search — not exposed to checkout, and confirmed (per Scenario 52's own findings) to have no FK relationship to `Customer.customerType`. Two separate "employee" concepts live in the system today with no link between them.
3. **The exact UI/logic precedent for "skip credit application for this class of customer" already exists and is proven**: `isGovernmentInstitutionalCustomer` in `frontend/src/app/(app)/(dashboard)/pos/checkout/page.tsx` (~line 1206-1208) is derived from the selected customer's own fields and, both client-side (~4108-4112) and server-side (`backend/src/pos/transactions.service.ts` ~265-300), skips the credit-application requirement entirely. The employee flag's credit-application skip should mirror this exact branch.
4. **The exact UI/logic precedent for a conditionally-required, transaction-level reference field already exists**: `tpfReferenceNumber` (`frontend/src/schema/pos/index.ts:307, 421`; `schema.prisma:3552`) — free text, required only when TPF installment lines exist in the cart, entered once per cart, validated both client-side (checkout/page.tsx ~2410-2419) and server-side (`backend/src/pos/dto/pos.dto.ts:628-642`). The new HR loan number field should mirror this shape.
5. **Down payment is already per-line, not per-transaction** (`CartLine.downPaymentInput` → `PosTransactionLine.downPayment`, `schema.prisma:4319`), so zeroing it out for "whichever installment line(s) exist in this cart" requires no new per-line plumbing — the field already exists per line.
6. **A same-named feature existed once and was retired.** `EmployeeApplianceLoan` (Scenario 40 Part 4) — an Accounting-module feature, appliance + employee, principal-only GL posting — was fully removed in Scenario 52 (2026-09-17/18); its Prisma model/table (`employee_appliance_loans`, `schema.prisma:2195-2246`) still holds historical rows only. It was replaced by `EmployeeCashLoan`, a cart-unrelated cash advance issued from its own standalone POS screen. Neither retired model nor `EmployeeCashLoan` touches the cart/checkout flow this scenario adds to.

## What's not done / gaps ❌⚠️

1. **No employee-aware UI exists anywhere in checkout.** `customerType`/`employeeNumber` are never read by `checkout/page.tsx` today — no badge, no checkbox, nothing.
2. **No zero-down-payment path exists anywhere in the system.** The 10%-of-line-amount minimum is hard-coded with no carve-out, in four places: client badge/default (checkout/page.tsx ~4233-4359), client submit validation (~2434-2452), and **server-side** `backend/src/pos/transactions.service.ts` lines ~458-460 and ~503-505 (both inhouse and TPF line checks). All four need an explicit exception for this flag; the server-side checks are the ones that actually matter for safety.
3. **No "HR Appliance Loan Application Number" field exists anywhere** — net new, on both the transaction schema/DTO and the checkout UI.
4. **No flag exists to persist "this sale is an Employee Appliance Loan"** on `PosTransaction` — needed so the down-payment carve-out and the required-field validation can both key off it server-side (mirroring how `isGovernmentInstitutionalCustomer` is derived, or explicitly stored — TBD, see Open Questions).

## Decisions taken

Confirmed with the developer, 2026-09-26:

| Question                                                                 | Decision                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which "employee" identity triggers this flow?                            | **`Customer.customerType === 'employee'`** (the existing POS/CRM tag). Not the real HR `Employee` table — no new employee-search UI needed in checkout.                                                                                                                         |
| Is the checkbox automatic, manual, or hybrid?                            | **Hybrid.** Auto-checks itself when the selected customer is employee-tagged, but the cashier can uncheck it. Not a silent, un-editable behavior like the government-institutional-customer path.                                                                               |
| Does "no down payment" apply to in-house only, or all financing options? | **All of them** — in-house and TPF both get down payment forced to ₱0 when the flag is active. (Credit card has no down payment concept in this system regardless.)                                                                                                             |
| Does the Payment Mode selector narrow to only In-house/TPF/Credit Card?  | **No — leave Payment Mode exactly as it is today** (Cash / Installment / Debit-Credit Card, unchanged). The only behavior change is forcing down payment to ₱0 wherever an installment line exists. Initially proposed narrowing the options was **rejected** by the developer. |
| Does checking the box skip the credit application requirement?           | **Yes**, mirroring the existing government-institutional-customer skip exactly.                                                                                                                                                                                                 |

## Closing the gaps — proposed parts

Each part gets its own e2e coverage and manual test steps, and stops for confirmation before the next begins (house convention).

### Part 1 — Checkout UI

- Employee badge next to the selected customer's name when `customerType === 'employee'` (informational only).
- New checkbox below the customer block: "Employee Appliance Loan (no down payment, no credit application required)" — defaults to checked when the badge is present, otherwise unchecked; always editable once a customer is selected.
- When checked: force every installment line's down payment input to ₱0 and lock it (replacing the "10% min" badge with something like "Down payment waived — Employee Appliance Loan"); hide the Approved Credit Application selector and "Raise one for this cart" button; show the new required "HR Appliance Loan Application Number" free-text field.
- Confirm-button client-side validation: require the HR loan number when the checkbox is active; drop the 10%-floor check for lines covered by this flag.

### Part 2 — Backend

- New field to persist the flag on `PosTransaction` (naming TBD — see Open Questions, given the retired model's name collision) and the new `hrApplianceLoanApplicationNumber` string field, both in DTO (`pos.dto.ts`) and Prisma schema.
- Carve-out in the two down-payment floor checks in `transactions.service.ts` (~458-460, ~503-505): skip the 10% minimum when the new flag is set on the transaction.
- Extend the existing credit-application-requirement check (~265-300) to also skip when the new flag is set, alongside the existing `isGovernmentInstitutionalCustomer` condition.
- Server-side validation requiring the HR loan number whenever the flag is set, mirroring how `tpfReferenceNumber` is conditionally required today.

### Part 3 — Tests

- Backend e2e: a sale with the flag set skips credit-application requirement, allows ₱0 down payment on inhouse/TPF lines, rejects submission without the HR loan number, and persists the number correctly.
- Frontend e2e: checkbox auto-checks for an employee-tagged customer, can be unchecked, down payment field locks to zero and unlocks correctly if unchecked, HR loan number field appears/required only when checked, credit-application UI disappears/reappears correctly.

## Not in this scenario

- Any change to the retired `EmployeeApplianceLoan` model/table (stays untouched, historical-only) or to `EmployeeCashLoan` (unrelated, standalone POS screen, not a sale).
- Any new employee search against the real HR `Employee` table — the flag is keyed off `Customer.customerType` only.
- Any new GL/accounting treatment specific to this flow — it rides the existing installment posting logic, just with a ₱0 down payment.
- Any change to which Payment Mode options are shown at checkout.

## Open questions

- **Naming collision**: is reusing the customer-facing label "Employee Appliance Loan" — the exact name of a feature retired nine days ago (Scenario 52) — intentional, or should this be labeled differently in the UI/internally to avoid confusion with the old Accounting-module feature? The underlying mechanism is unrelated to both the old model and `EmployeeCashLoan`.
- **Flag naming on `PosTransaction`**: needs a name that doesn't collide with the retired `EmployeeApplianceLoan` Prisma model/enum still sitting in the schema.
- **Checkbox availability for non-tagged customers**: should the checkbox be usable at all when the selected customer is _not_ tagged `customerType: employee` (covering incomplete data), or should it be hidden/disabled unless the tag is present? Current plan (Part 1) leaves it always available once a customer is selected — flagging in case that's too permissive.
- **HR loan number field scope**: assumed transaction-level (once per cart, like `tpfReferenceNumber`), not per-line — confirm this matches intent, since a single checkout could in theory contain multiple appliance items under one employee loan approval.
