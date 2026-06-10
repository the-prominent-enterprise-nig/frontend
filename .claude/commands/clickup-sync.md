---
name: clickup-sync
description: "Full TPE backlog sync — pulls new tickets from ClickUp into tickets.md, scans the codebase for implemented features and marks matching tickets as 'for QA', and logs new untracked tickets as TO DO."
argument-hint: "Optional: module name to scope sync (e.g. 'HR', 'POS', 'super-admin')"
---

# ClickUp Sync — TPE

You are an Agile PM assistant for the **Prominent Enterprise (TPE)** project.

**The sync does three things in order:**

1. Pull all tasks from ClickUp → update local `tickets.md` files
2. Scan the codebase → find features that are implemented but not marked `for QA`
3. Apply changes: update ClickUp statuses + report new tickets as `TO DO`

---

## Workspace Context

- **Workspace:** TPE (space ID `90167097004`)
- **Backlog folder ID:** `90169820258`
- **Local backlog root:** `backlog/`

**Status workflow:**

```
TO DO → in progress → in review → for QA → failed QA → DONE
```

**Module → List ID + File:**

| Module dir(s)                                                                 | ClickUp list                 | List ID        | Local file                                 |
| ----------------------------------------------------------------------------- | ---------------------------- | -------------- | ------------------------------------------ |
| `enterprise`                                                                  | 01 - Business & Tenant (TEN) | `901615166750` | `backlog/01-business-tenant/tickets.md`    |
| `employee`, `attendance`, `leave-management`, `payroll`, `payslip`, `holiday` | 02 - Human Resources (HR)    | `901615166751` | `backlog/02-human-resources/tickets.md`    |
| _(no module)_                                                                 | 03 - Files & Documents       | `901615166752` | `backlog/03-files-documents/tickets.md`    |
| `auth`, `roles`, `permissions`                                                | 04 - RBAC                    | `901615166754` | `backlog/04-rbac/tickets.md`               |
| `inventory`, `supplier`                                                       | 05 - Inventory (INV)         | `901615166755` | `backlog/05-inventory/tickets.md`          |
| `pos`                                                                         | 06 - Point of Sale (POS)     | `901615166757` | `backlog/06-pos/tickets.md`                |
| `sales`                                                                       | 07 - Sales & Orders (SO)     | `901615166758` | `backlog/07-sales-orders/tickets.md`       |
| `accounting/*`                                                                | 08 - Accounting (ACC)        | `901615166760` | `backlog/08-accounting/tickets.md`         |
| `procurement`                                                                 | 09 - Procurement (PRO)       | `901615166763` | `backlog/09-procurement/tickets.md`        |
| `crm`                                                                         | 10 - CRM                     | `901615166764` | `backlog/10-crm/tickets.md`                |
| `queue-management`                                                            | 11 - Queue Management (QMS)  | `901615166765` | `backlog/11-queue-management/tickets.md`   |
| _(no module)_                                                                 | 12 - Project Management (PM) | `901615166766` | `backlog/12-project-management/tickets.md` |
| _(no module)_                                                                 | 13 - Dashboard & BI          | `901615166768` | `backlog/13-dashboard-bi/tickets.md`       |
| `super-admin`                                                                 | 14 - Super Admin             | `901615260216` | `backlog/14-super-admin/tickets.md`        |

---

## Procedure

### Phase 1 — Pull from ClickUp

Use `clickup_filter_tasks` with `folder_ids: ["90169820258"]` and `include_closed: true`.
Paginate until `count < 100` or `has_more` is false.

If an argument was passed (e.g. `HR`), scope to that list only using its `list_id`.

For each task fetched from ClickUp, compare against the local `backlog/<module>/tickets.md`:

- **Task exists in local file** → update its status and name in the local file to match ClickUp
- **Task does NOT exist in local file** → it is a new ticket; append it to the local file with its current ClickUp status. Label it `[NEW]` in the report.

Write the local file in this format:

```markdown
---
list: '<ClickUp list name>'
list_id: '<ClickUp list ID>'
last_synced: '<YYYY-MM-DD>'
---

# <List Name> Tickets

## Summary

| ID     | Title       | Status | Priority | ClickUp |
| ------ | ----------- | ------ | -------- | ------- |
| TEN-17 | [task name] | TO DO  | normal   | [link]  |

---

## Tickets

### [TASK-ID] — [Task name]

**Status:** [status]
**Priority:** [priority]
**ClickUp:** [task URL]

[description if available]

---
```

- If the file does not exist, create the directory and file from scratch.
- If the file exists, **merge** — preserve locally-authored ticket descriptions not yet in ClickUp.

---

### Phase 2 — Scan codebase for implemented features

Run:

```bash
find src/ -maxdepth 1 -type d
find src/ -name "*.controller.ts" | sort
```

For each module directory that exists in `src/` **and** has at least one `.controller.ts`:

1. Map it to the corresponding ClickUp list using the table above
2. Read the endpoints from the controller: `grep -E "@(Get|Post|Patch|Put|Delete)\(" src/<module>/<module>.controller.ts`
3. Load the `backlog/<module>/tickets.md` file

For each ticket in that module's list, determine if it is **implemented** using this heuristic:

> A ticket is considered **implemented** if:
>
> - The module exists in `src/` with a controller, **AND**
> - The ticket's title describes a feature that maps to one of the controller's endpoints or CRUD operations (e.g. "create employee" → `@Post`, "view payroll" → `@Get`, "update status" → `@Patch`)

Tickets that describe advanced/future features (e.g. multi-currency, AI-generated insights, SSO, BOM, RFQ) that have no matching endpoint should be left at their current status.

---

### Phase 3 — Mark implemented features as "for QA"

Collect all tickets identified as implemented in Phase 2 whose current ClickUp status is **not** already `for QA`, `in review`, `failed QA`, or `DONE`.

Show the user a single summary of all pending changes before applying anything:

```
The following tickets appear to be implemented in the codebase.
They will be moved to "for QA" in ClickUp and tickets.md:

  QMS  | RQM-05 — Live table status board          | TO DO → for QA
  QMS  | RQM-06 — Combine and split tables          | TO DO → for QA
  HR   | HR-03  — View employee list                | in progress → for QA
  ...

Confirm? (y / n / review one by one)
```

- `y` → apply all changes
- `n` → apply none, just update tickets.md from Phase 1
- `review one by one` → prompt each ticket individually with `y / n`

For each confirmed ticket:

1. Call `clickup_update_task` with `status: "for QA"`
2. Update the status in the local `backlog/<module>/tickets.md`

If rate-limited (502), wait 60 seconds and retry. Never skip a confirmed change.

---

### Phase 4 — Report

```
## Sync Report — [date]

### New tickets pulled from ClickUp
| Module | ID | Title | Status |
|---|---|---|---|
| HR | HR-51 | [name] | TO DO |

### Updated to "for QA"
| Module | ID | Title | Previous status |
|---|---|---|---|
| QMS | RQM-05 | Live table status board | TO DO |

### Skipped (user declined or already correct)
| Module | ID | Title | Status |
|---|---|---|---|
| QMS | RQM-09 | Accurate wait times | in progress |

### tickets.md files written
- backlog/11-queue-management/tickets.md (23 tasks)
- backlog/02-human-resources/tickets.md (31 tasks)
- ...

### Modules with no ClickUp list (create tickets with /clickup-create-ticket)
- src/super-admin → already has list 14
- [any gaps found]
```

---

## Quality Checks

- [ ] Always pull from ClickUp first — local file is secondary
- [ ] Never downgrade a status (e.g. `for QA` → `TO DO`)
- [ ] Never auto-change `in review` or `failed QA` — those are active human states
- [ ] Always show the full change list to the user before applying
- [ ] Write local files before pushing status changes to ClickUp
- [ ] If rate-limited, wait 60s and retry — never skip a confirmed change

## Tools Used

- `clickup_filter_tasks` — fetch all tasks from ClickUp
- `clickup_update_task` — update task status in ClickUp
- `Bash` — scan src/ directories and controller files
- `Read` / `Write` / `Edit` — manage local `tickets.md` files
