---
name: clickup-push
description: "Commit and push recent changes, then find the matching ClickUp ticket and mark it as 'in review'. Reads ticket ID from branch name or commit message. Auto-assigns the ticket to the current user unless --no-assign is passed."
argument-hint: "Optional: ticket ID to override auto-detection (e.g. 'SA-03'). Pass --no-assign to skip assignee update."
---

# ClickUp Push — TPE

You commit and push the current branch, then locate the matching ClickUp ticket and move it to `in review`.

## Workspace Context

- **Workspace:** TPE (space ID `90167097004`)
- **Local backlog root:** `backlog/`
- **Status to set:** `in review`

---

## Flags

| Flag          | Effect                                        |
| ------------- | --------------------------------------------- |
| `--no-assign` | Skip assigning the ticket to the current user |

---

## Procedure

### Phase 0 — Resolve current user

Unless `--no-assign` was passed:

1. Call `clickup_get_workspace_members` with `workspace_id: "90167097004"`
2. Find the member whose email or username matches the git user:
   - Run `git config user.email` to get the current git email
   - Match against the members list
3. Store their `id` as `CURRENT_USER_ID` for use in Phase 4
4. If no match found, skip assignment silently (do not error)

### Phase 1 — Check working tree

Run `git status` to see what's staged and unstaged.
Run `git diff --stat` to summarize changes.

If there are no changes to commit, report "Nothing to commit" and stop.

### Phase 2 — Stage and commit

If changes exist:

1. Show the user the diff summary
2. Ask for a commit message if none is obvious, or propose one based on the diff
3. Stage relevant files (never use `git add .` blindly — stage by directory or file)
4. Commit with the proposed message

Commit message convention:

```
<type>(<module>): <short description>

Types: feat | fix | refactor | chore | test | docs
Module: the src/ folder name (e.g. super-admin, pos, hr)

Examples:
  feat(super-admin): add enterprise status toggle endpoint
  fix(pos): correct VAT rounding on grouped totals
```

### Phase 3 — Find matching ClickUp ticket

**Method 1 — Argument override:** If the user passed a ticket ID (e.g. `SA-03`), use that directly.

**Method 2 — Branch name:** Run `git branch --show-current`.
Extract ticket ID using these patterns:

- `feat/SA-03-create-enterprise` → `SA-03`
- `fix/pos-54-vat-rounding` → `POS-54`
- `sa-03` → `SA-03`
- Pattern: `[A-Z]+-\d+` or `[a-z]+-\d+` anywhere in the branch name

**Method 3 — Commit message:** Scan the latest commit message for a ticket ID pattern (`[A-Z]+-\d+`).

**Method 4 — Local tickets.md search:** If no ID found yet:

1. Identify the module from the staged files (e.g. `src/super-admin/` → Super Admin)
2. Read `backlog/14-super-admin/tickets.md` (or relevant module file)
3. Show the user the list of tickets in that module and ask: "Which ticket does this commit belong to?"

If still no match, ask the user directly: "Enter the ticket ID (e.g. SA-03), 'none' to skip, or 'new' to create a ticket for this commit."

- If the user enters a ticket ID → proceed to Phase 4
- If `none` → skip Phase 4, go straight to Phase 5 (still push the code)
- If `new` → run the `/clickup-create-ticket` skill inline for this module/feature, then use the newly created ticket ID in Phase 4

### Phase 4 — Update ClickUp status

Once the ticket ID is confirmed:

1. Use `clickup_search` or look up the task ID from the local `tickets.md` file
2. Call `clickup_update_task` with:
   - `status: "in review"`
   - `assignees: [CURRENT_USER_ID]` — only if `CURRENT_USER_ID` was resolved and `--no-assign` was not passed
3. Update the status in the local `backlog/<module>/tickets.md` file

If the ticket is already `in review` or beyond (`for QA`, `DONE`), still apply the assignee update (if applicable) but do not downgrade the status.

If rate-limited (502), wait 60 seconds and retry.

### Phase 5 — Push

Run `git push` (with `-u origin <branch>` if the branch has no upstream yet).

### Phase 6 — Report

```
## Push Report

Committed: "<commit message>"
Branch: <branch name>
Ticket: <TICKET-ID> — <ticket name>
Status: → in review
Assigned: <name> (or "skipped — --no-assign" / "skipped — no member match")
Pushed: ✓
```

---

## Quality Checks

- [ ] Never commit sensitive files (.env, credentials)
- [ ] Never force push to main/master
- [ ] Never downgrade a ticket status (e.g. `for QA` → `in review`)
- [ ] Always confirm the ticket match with the user if auto-detection is uncertain
- [ ] Update local `tickets.md` to match the new ClickUp status
- [ ] If member lookup fails, skip assignment silently — never block the push over it

## Tools Used

- `Bash` — git status, diff, add, commit, push, branch, git config user.email
- `clickup_get_workspace_members` — resolve current user's ClickUp member ID
- `clickup_update_task` — update ticket status and assignee
- `clickup_search` — find task by name if ID not in local file
- `Read` — read local `tickets.md` to look up task IDs
- `Edit` — update status in local `tickets.md`
