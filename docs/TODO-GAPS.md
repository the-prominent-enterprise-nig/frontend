# TO DO — Known Gaps

A running list of known gaps and deliberately deferred work — not yet implemented, but not forgotten either. Distinct from `scenario-checklist.md` (implementation-status log per scenario) and `backlog/*/tickets.md` (formal AA ISBAT tickets): this is a lightweight, cross-scenario list for things to come back to that don't have a ticket yet.

---

## Employee Cash Loan (Scenario 52)

- [ ] **Automatic payroll deduction / repayment recognition.** Nothing reduces a loan's `currentBalance` today — it sits equal to `openingBalance` forever until this is built. Needs its own scoping pass (how a payroll expense line identifies which loan it's paying down, given there's no structural link between a payroll line's typed name and a specific `EmployeeCashLoan` row today).
- [ ] **Interest-release batch.** Recognizing the deferred `UNEARNED_INTEREST_INCOME` as earned `FINANCING_INCOME` over time, period by period. Pattern to mirror: `installment-interest-release.service.ts` (built for customer `InstallmentSchedule`/`InstallmentScheduleLine`) — not yet built for the employee-loan schedule table.
- [ ] **No manual "Record Payment" action anywhere**, POS or Accounting, for this loan type. Repayment isn't recordable at all yet, by anyone.
- [ ] **Old Special Account "Employee Cash Loan" type is now a disconnected duplicate.** Accounting's Expense screen (`Payee → Other → Employee Cash Loan`) still posts a separate, interest-free flat balance under the same name as the new POS amortizing loan. Decide: deprecate/relabel the old one, or keep both for genuinely different use cases?

See `docs/scenario-52-employee-cash-loan-pos-plan.md` for full context and the Implementation Log.
