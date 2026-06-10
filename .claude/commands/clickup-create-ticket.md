---
name: clickup-create-ticket
description: 'Create a new TPE ClickUp ticket in AA ISBAT format. Saves to the local backlog/tickets.md first, shows the user a preview, then prompts before pushing to ClickUp. Auto-assigns to the current user on creation unless --no-assign is passed.'
argument-hint: "Module and feature description (e.g. 'HR: time-log CRUD for employees'). Pass --no-assign to skip assignee."
---

# ClickUp Create Ticket — TPE

You write a fully structured ClickUp ticket in the `AA [Role], ISBAT` format, save it locally, and wait for user approval before creating it in ClickUp.

## Workspace Context

- **Workspace:** TPE (space ID `90167097004`)
- **Backlog folder ID:** `90169820258`
- **Local backlog root:** `backlog/`

**Module → List ID + File:**

| Module                  | List ID        | File                                       |
| ----------------------- | -------------- | ------------------------------------------ |
| Business & Tenant (TEN) | `901615166750` | `backlog/01-business-tenant/tickets.md`    |
| Human Resources (HR)    | `901615166751` | `backlog/02-human-resources/tickets.md`    |
| Files & Documents       | `901615166752` | `backlog/03-files-documents/tickets.md`    |
| RBAC                    | `901615166754` | `backlog/04-rbac/tickets.md`               |
| Inventory (INV)         | `901615166755` | `backlog/05-inventory/tickets.md`          |
| Point of Sale (POS)     | `901615166757` | `backlog/06-pos/tickets.md`                |
| Sales & Orders (SO)     | `901615166758` | `backlog/07-sales-orders/tickets.md`       |
| Accounting (ACC)        | `901615166760` | `backlog/08-accounting/tickets.md`         |
| Procurement (PRO)       | `901615166763` | `backlog/09-procurement/tickets.md`        |
| CRM                     | `901615166764` | `backlog/10-crm/tickets.md`                |
| Queue Management (QMS)  | `901615166765` | `backlog/11-queue-management/tickets.md`   |
| Project Management (PM) | `901615166766` | `backlog/12-project-management/tickets.md` |
| Dashboard & BI          | `901615166768` | `backlog/13-dashboard-bi/tickets.md`       |
| Super Admin             | `901615260216` | `backlog/14-super-admin/tickets.md`        |

---

## Flags

| Flag          | Effect                                                                |
| ------------- | --------------------------------------------------------------------- |
| `--no-assign` | Skip assigning the ticket to the current user when pushing to ClickUp |

---

## Procedure

### Phase 0 — Resolve current user

Unless `--no-assign` was passed:

1. Call `clickup_get_workspace_members` with `workspace_id: "90167097004"`
2. Run `git config user.email` to get the current git user's email
3. Match against the members list — store their `id` as `CURRENT_USER_ID`
4. If no match, skip assignment silently

### Phase 1 — Gather input

If the user passed an argument (e.g. `"HR: time-log CRUD for employees"`), parse it for:

- **Module** — which module/list this belongs to
- **Feature** — what user goal this ticket covers

If no argument was passed, ask:

1. "Which module is this for?" (show the list above)
2. "Describe the feature in one sentence."
3. "What is the user role? (e.g. HR Manager, Employee, Admin, Super Admin)"
4. "Is this already implemented in the codebase? (y / n)"

Optionally scan the relevant controller for context:

```bash
find src/<module> -name "*.controller.ts" | xargs grep -E "@(Get|Post|Patch|Put|Delete)\("
```

### Phase 2 — Determine ticket ID

Read the local `backlog/<module>/tickets.md` file (if it exists) to find the highest existing ticket number for that module prefix. Assign the next number.

If the file doesn't exist, start at `01`.

Example: if `backlog/02-human-resources/tickets.md` has HR-01 through HR-50, the new ticket is `HR-51`.

### Phase 3 — Write the ticket

Generate the full ticket using this format exactly:

```markdown
### [MODULE-XX] — AA [Role], ISBAT [task in plain English]

**Status:** [for QA if implemented / TO DO if not]
**Priority:** [urgent / high / normal / low]
**ClickUp:** [pending — not yet pushed]

---

**Scenario:**
[One paragraph describing the context and user goal.]

**Given:**

- [Precondition 1]
- [Precondition 2]

**When:**

- [The user does X]

**Then:**
The system should:

- [Expected behavior 1]
- [Expected behavior 2]
- [List each visible UI element]

### [UI section name, e.g. "Fields", "Filters"]

- **[Element]:** [description and constraints]

### Buttons

- **[Label]**
  - [What it does; when disabled]

---

#### Empty States

- [What shows when there is no data]

---

#### Post-Action Behavior

- [Immediate system response after primary action]

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-[MODULE-XX]

**Title:** FE: [Short description]
**Parent:** [MODULE-XX]
**Contract:** `contracts/<module>/<feature>.contract.md`

**Scope:**

- [ ] Import/create TypeScript types matching API response shapes
- [ ] Create placeholder data layer returning mock response data
- [ ] Create server action stub for the relevant endpoint(s)
- [ ] Build [component/page] per Figma
- [ ] Handle all error codes from the contract
- [ ] Add loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-[MODULE-XX]-[endpoint-slug]

**Title:** BE: [METHOD /path] — [what it does]
**Parent:** [MODULE-XX]
**Contract:** `contracts/<module>/<feature>.contract.md`

**Scope:**

- [ ] Implement `[METHOD /path]` — [description], returns `[shape]`
- [ ] Request validation: [constraints]
- [ ] Response shape matches `{ data, meta }` wrapper
- [ ] Error responses: `[ERROR_CODE_1]`, `[ERROR_CODE_2]`
- [ ] Auth: [public / bearer token / super-admin guard]

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly
- Validation errors MUST use exact contract error codes
- All required fields MUST be validated server-side
```

### Phase 4 — Save to local file

Append the ticket to `backlog/<module>/tickets.md`:

1. If the file does not exist, create it with this header first:

```markdown
---
list: '<ClickUp list name>'
list_id: '<ClickUp list ID>'
last_synced: "<today's date>"
---

# <Module Name> Tickets

## Summary

| ID  | Title | Status | Priority |
| --- | ----- | ------ | -------- |

---

## Tickets
```

2. Append the new ticket body under `## Tickets`
3. Add a row to the `## Summary` table

### Phase 5 — Show preview and prompt

Display the full ticket to the user and ask:

```
--- Ticket Preview ---
[ticket content]
----------------------

Push this ticket to ClickUp?
  y  — create in ClickUp now
  e  — let me edit first
  n  — save locally only (push later with /clickup-sync)
```

- `y` → proceed to Phase 6
- `e` → open the ticket in the editor, wait for the user to signal done, then re-prompt
- `n` → stop here; ticket is saved locally only

### Phase 6 — Push to ClickUp

If the user confirmed:

1. Call `clickup_create_task` with:
   - `list_id`: the correct list ID from the mapping above
   - `name`: `[MODULE-XX] — AA [Role], ISBAT [task]`
   - `status`: `for QA` if implemented, `TO DO` if not
   - `priority`: as determined
   - `markdown_description`: the full ticket body
   - `assignees: [CURRENT_USER_ID]` — only if resolved and `--no-assign` was not passed

2. Update the local `tickets.md` entry — replace `ClickUp: pending — not yet pushed` with the real task URL from the response.

### Phase 7 — Report

```
## Ticket Created

ID: [MODULE-XX]
Title: AA [Role], ISBAT [task]
Saved to: backlog/<module>/tickets.md
ClickUp: [task URL or "not pushed"]
Status: [status]
Assigned: <name> (or "skipped — --no-assign" / "skipped — no member match" / "not pushed to ClickUp")
```

---

## Quality Checks

- [ ] Never push to ClickUp without user confirmation
- [ ] Always save to local file before prompting (so work is never lost)
- [ ] Ticket ID MUST be unique — always read existing file to find next number
- [ ] If the module file doesn't exist, create the directory and file first
- [ ] If rate-limited (502), wait 60s and retry
- [ ] If member lookup fails, skip assignment silently — never block ticket creation over it
- [ ] Only assign on ClickUp push (Phase 6) — do not assign on local-only saves

## Tools Used

- `clickup_get_workspace_members` — resolve current user's ClickUp member ID
- `Bash` — git config user.email, scan controller files for endpoint context
- `Read` — read existing `tickets.md` to find next ticket number
- `Write` / `Edit` — create or append to local `tickets.md`
- `clickup_create_task` — create task in ClickUp (with assignees)
- `AskUserQuestion` — gather input in Phase 1 and prompt in Phase 5
