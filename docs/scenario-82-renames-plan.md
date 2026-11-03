# Scenario 82 — Oct 29 UAT renames

Source: the "NIG Marketing UAT Checklist" artifact (Oct 29 2026 UAT notes), its **Rename** items only.
Built on `origin/development` (FE `8b8c6eb0`, BE `273b25f`), 2026-11-03.

## Scope

| ID             | Change                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| SC-02          | "Repair Provider" → "Service Center" on every repair screen, and in Account Mapping (BE)    |
| POS-20 / CS-01 | "Counter collections" → "MI collections" in Close Session and on the Session Closed summary |

Only what users read changes. Codes, keys, routes, columns and API fields keep their names
(`repairProviderId`, `REPAIR_PROVIDER_PAYABLE`, `/repair-provider`, `repair_provider_not_found`).

### Left out, and why

| ID                  | Why                                                        |
| ------------------- | ---------------------------------------------------------- |
| WH-02, WH-03, WH-04 | Done on development by FE #270 / BE #250 (Karm)            |
| STR-02, POS-08      | P4 but not renames; Kian kept the scenario to renames only |
| POS-18              | Needs the sale-date override (POS-15), which is not built  |

## Changes

### Frontend

- UDS: Issue UDS, Assess, Set/Change Service Center, the detail view, the list column
  (**Units / Service Center**), toasts, the error map, the document trail legs (**Main to service center**,
  **Service center to main**), the unit picker's empty state, the overrun note on Receive Back, and the
  coverage warning (**This service center isn't on file as a supplier of:**).
- Delivery Receipt: the party field for **For repair to service center**, and its error **Pick the service
  center**.
- Receiving Report from a service center: the help text.
- Close Session: **MI collections** in the cash breakdown and **MI collections (cash)** on the summary.

### Backend

- Account Mapping: **Service Center Payable**, and both repair descriptions say service center.
  `ensureStandardKeys()` rewrites the label on every load, so existing databases pick it up with no migration.
- The repair variance journal entry's fallback payee reads **the service center** when the ticket has none.

### Tests

- BE unit: `account-mapping.service.spec.ts` checks the new label, on create and on update, and that no
  mapping mentions "repair provider".
- FE e2e: `e2e/scenario-82-renames.spec.ts` (Issue UDS form, UDS list column, Account Mapping,
  Close Session). `repair-transfer-uds.spec.ts` and `uds-transfer-driven.spec.ts` use the new labels.
- Manual: `NIG/Scenario-82-Manual-Test.md`.
