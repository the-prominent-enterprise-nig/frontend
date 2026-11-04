# Scenario 83 — Turn over undeposited cash to another branch

Source: client request (2026-11-04). A caravan (or any branch) that can't reach a bank hands its
closed sessions' cash to another branch, which banks it with its own. Screenshot: the
**Record deposit** sheet with a **Settle as: Deposit to bank | Turn over to branch** toggle.

## Decisions (developer, 2026-11-04)

| #   | Question                      | Decision                                                                       |
| --- | ----------------------------- | ------------------------------------------------------------------------------ |
| D1  | Who can turn over             | **Any branch's sessions**, not only caravans                                   |
| D2  | Receiving branch confirms?    | **Yes.** In transit until a user at the receiving branch confirms receipt      |
| D3  | How the cash reaches the bank | Joins the **receiving branch's Undeposited Funds**, banked by its next deposit |
| D4  | Split turnover and bank slips | **Allowed.** Turnover(s) + bank slips must cover the session balance           |
| D5  | Receiving branch              | **Any active branch** except the sending one (and not a caravan)               |

## Current state (verified 2026-11-04, FE `af0f44ad`)

- `PosDeposit` is bank-only: every `PosDepositLine` has a `bankAccountId`. `record()` creates a
  draft and clears it at once (`pos-deposits.service.ts`).
- A caravan's sessions post under the **host branch** (`PosTerminal.caravanBranchId`), and are
  deposited on their own. The caravan's cashier may record it (`sessionsBranch`).
- `MAPPING_KEYS.CASH_IN_TRANSIT` already exists (used by the legacy close sweep).
- No inter-branch cash movement exists anywhere.

## Design

### Data (BE migration)

New model `PosCashTurnover`:

| Field                                                          | Notes                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| `id`, `tenantId`, `controlNumber` (`TO-…`)                     |                                                        |
| `posDepositId`                                                 | The settlement it was recorded in                      |
| `fromBranchId`, `fromCaravanBranchId?`                         | Sender (caravan kept for the report label)             |
| `toBranchId`                                                   | Receiving branch                                       |
| `amount`                                                       | Cash only. Card/e-wallet clearing can't be handed over |
| `slipNumber`, `receivedByName`, `turnoverDate`                 | From the form                                          |
| `status`: `in_transit` · `received` · `rejected` · `cancelled` |                                                        |
| `sentJournalEntryId`, `receivedJournalEntryId`                 |                                                        |
| `confirmedById`, `confirmedAt`, `rejectReason`                 |                                                        |

`PosDepositAllocation` gets a nullable `posCashTurnoverId`, so the receiving branch's deposit can
bank a received turnover the way it banks a New Receipt today.

### GL

The client mockup posts **Dr Inter-branch Receivable / Cr COH-Branch Collection**, then the reverse on
acknowledgment. Fit with the current system:

- **COH-Branch Collection** is already the `POS_CASH` mapping (1-01-010, _Cash on Hand - Branch
  Collections_). No change needed.
- **Inter-branch Receivable** isn't in the client's COA. The closest is **1-01-047 Fund Transfers in
  Transit** ("sent but not yet received; should be zeroed"), which is already mapped as
  `CASH_IN_TRANSIT`. Add a mapping key `INTER_BRANCH_TURNOVER` that defaults to 1-01-047, so
  accounting can point it at a new account later without code changes.
- The mockup tags each line with its own branch, but `JournalEntry.branchId` is set on the
  **header**, and lines have no branch. Line-level branch would be a schema and reporting change
  across all of accounting, so it's out of scope. Post **two entries, one per branch**:

| Event                      | Entry                                                                   | JE branch |
| -------------------------- | ----------------------------------------------------------------------- | --------- |
| Turnover (sender)          | Dr Inter-branch / Cr COH-Branch Collection                              | Sender    |
| Acknowledge (receiver)     | Dr COH-Branch Collection / Cr Inter-branch                              | Receiver  |
| Reject / cancel in transit | Reverse the turnover entry; the cash is undeposited at the sender again | Sender    |

Company-wide, the inter-branch account goes back to zero on acknowledgment, which is what the mockup
wants. In a per-branch view, the sender shows +X and the receiver −X. That's the usual in-transit
pattern, and inter-account fund transfers already work this way.

### Mockup fit (UI)

| Mockup                                              | Current system                                                             | Plan                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settle as toggle + turnover block in Record deposit | `DepositForm` + `SlipEditor` (bank slips only)                             | **Fits.** Add the toggle and a turnover block above `SlipEditor`, and extend `DepositTally`                                                                |
| Ledger columns Date · Type · Sender→Receiver · Slip | Session · Closed · Deposit date · Status · Collected · Deposited · Balance | **Keep the current columns.** A full table redesign would change every deposit row. Turnover shows in the existing cells instead (below)                   |
| _Turnover out_ · Awaiting acknowledgment (sender)   | Statuses `to_deposit` · `awaiting` · `deposited`                           | New status `turned_over`, chip **Turned over · awaiting ack** / **Turned over**, receiving branch and slip no. under the session                           |
| _Turnover in_ row + **Acknowledge** (receiver)      | New Receipts already show as extra rows banked with the branch             | Same pattern as New Receipts: an incoming row with a pending chip and an **Acknowledge** button (and Reject), plus _Acknowledged · date · name_ afterwards |
| Not counted as receiver's cash until acknowledged   | Balance column = what's still undeposited                                  | A pending row shows its amount but stays out of Balance and Undeposited until acknowledged                                                                 |
| "Pending turnover" on both collection reports       | Daily Collection Report                                                    | Part 6                                                                                                                                                     |

The sessions count as settled (by the turnover) when the send entry posts, the same as when a
bank slip clears.

### Flow

1. **Sender: Record deposit.** New **Settle as** toggle. _Turn over to branch_ shows a turnover
   block: receiving branch (`SearchableSelect`), amount, received by, slip no., date. Bank slips
   stay available for the rest (D4). The tally reads `Turnovers ₱X · Bank deposits ₱Y` against the
   session balance.
2. **Receiver: Undeposited Funds.** `in_transit` turnovers addressed to the branch show as rows
   in its ledger (like New Receipts), with **Acknowledge** and **Reject** (reason required).
3. **Receiver, after confirming.** The turnover appears as a row in the branch's ledger (like a New
   Receipt: "Turnover from Ajuy · TO-0001") and is banked automatically with the next Record deposit.
4. **Sender's ledger** shows the sessions as _Turned over · in transit_ and then _Turned over_,
   or back to _To deposit_ if rejected.

### Permissions

- Record: existing deposit permission and the sender's branch scope (unchanged).
- Confirm/Reject: existing deposit permission, and `callerBranchId === toBranchId` (or an
  unrestricted user).

## Parts

| Part | Repo  | Scope                                                                                             |
| ---- | ----- | ------------------------------------------------------------------------------------------------- |
| 1    | BE    | Migration, `PosCashTurnover`, turnovers on `CreatePosDepositDto`, send JE, session settlement     |
| 2    | BE    | `GET /pos-deposits/turnovers?direction=incoming\|outgoing`, confirm/reject endpoints and JEs      |
| 3    | BE    | Received turnovers in the receiving branch's undeposited funds and allocation on its next deposit |
| 4    | FE    | Settle-as toggle, turnover block and tally in `DepositForm`, server action + types                |
| 5    | FE    | Turnover rows in both branches' ledgers (Acknowledge/Reject on the receiver's), CSV export        |
| 6    | BE+FE | Daily Collection Report and Deposits list show turnovers; e2e and manual test script              |

## Open (non-blocking, defaults assumed)

- Turnover slip no. is free text (default) vs auto-numbered `TO-0001`. Plan stores both: the
  typed slip no. and a system control number.
- One receiving branch per turnover block; several turnovers in one settlement are allowed.
- A received turnover can't be cancelled; it's corrected like a deposit (reverse + re-record).

## Progress (2026-11-04, branch `feat/pos-cash-turnover` in both repos)

Later decisions (developer):

- Keep the current ledger columns and just show turnover info in them.
- GL: two entries, one per branch, on a new `INTER_BRANCH_TURNOVER` mapping (defaults to 1-01-047;
  falls back to `CASH_IN_TRANSIT` while unset). To be confirmed with the client.
- **One specific place** for the receiving branch to acknowledge: the **Incoming turnovers** panel
  on its Undeposited Funds page. Nowhere else.
- Turnover amount and Received by start **empty** (no pre-fill).
- Turnovers show on the POS Daily Collection Report.

Built:

- BE: migration `20261104120000_pos_cash_turnover` (a turnover is a `PosDepositLine` with
  `turnoverToBranchId` and no bank; the header bank is nullable). Posting, validation (active
  branch, not self, not caravan/warehouse, cash only), `GET /pos-deposits/turnovers`,
  `POST /pos-deposits/turnovers/:lineId/acknowledge|reject`. Acknowledging creates a New Receipt at
  the receiver (Dr COH / Cr Inter-branch), banked with its day. Rejecting reposts the sender's
  deposit without the turnover, or cancels it if it was the turnover alone. Corrections are blocked
  once a turnover is acknowledged, and so are amount/account edits on the turnover's receipt.
  Ledger rows carry `turnovers`. DCR prints `Turnover → <branch> (pending acknowledgment)`.
- FE: Settle as toggle + turnover block in Record deposit (optional bank slips for a split; tally
  shows Turnovers / Bank deposits). Incoming turnovers panel (Acknowledge / Reject with reason).
  Ledger: "Turned over · awaiting acknowledgment" / "Turned over" chip with "Turnover → branch ·
  slip" under it. The receiver's acknowledged cash shows as "Undeposited · Turnover in". Deposit
  detail shows turnover lines. The DCR labels those lines TURNOVER.
- Tests: 3 unit tests (posting) and 7 e2e tests (S83-01…07), all passing. The 11 S61P5 e2e
  failures predate this work (they expect drafts; deposits now post on record).

Not yet done: manual browser pass; client confirmation of the inter-branch account.

### Acknowledgment rules (developer, 2026-11-04)

- **Maker-checker:** whoever recorded the turnover can't acknowledge or reject it (403).
- **Receiving branch only:** Acknowledge requires a user assigned to the receiving branch
  (`employee.branchId === turnoverToBranchId`); owners and Head Office get 403. They can still
  see the panel and Reject.
- The panel shows a button only when the user may use it, with a note otherwise
  ("You recorded this — someone else confirms it" / "Waiting for <branch> to acknowledge").
- e2e: the owner records the turnovers and is refused (403); the Branch Manager, temporarily moved
  to the receiving branch, acknowledges and rejects.

### Ledger layout follows the client mockup (developer, 2026-11-04)

Replaces "keep the current columns", the Incoming turnovers panel and the Turnovers tab (no
separate tab).

- One table (`CollectedFundsTable.tsx`): **Date · Session / Reference · Type · Sender → Receiver ·
  Slip / Ref no. · Amount · Status · Action**, a Total row, and branch group rows kept (select all,
  collapse, "₱X to deposit").
- Types: Branch collection · Bank deposit · Turnover out · Turnover in · New Receipt.
- A pending incoming turnover is a row in the receiving branch's group ("Pending · needs your
  action") with Acknowledge / Reject in the **Action** column — the one place it is done.
  Acknowledged, it stays a line of its own ("Turnover in · Acknowledged · For deposit"), not folded
  into a session.
- BE: ledger rows carry `bankSlips` (bank, ••last4, slip no.) beside `turnovers`.
  `GET /pos-deposits/turnovers` with no direction returns both directions. Outgoing finds a
  caravan's turnovers too.
- The Collected/Deposited/Balance columns and the running balance are gone. CSV export follows the
  new columns.

### Correcting a turnover (developer, 2026-11-04)

- Accounting (`accounting:cash-in-transit:correct`) can correct a turnover **while it's awaiting
  acknowledgment**: amount, receiving branch, slip no., received by and date. This is the same
  rule as a bank deposit, which is correctable until reconciled. The sender's entries are
  reversed and reposted; the turnover stays pending, now at the corrected branch.
- Once acknowledged, the deposit is final (backend 400; the Correct button is hidden).
- e2e S83-08.
