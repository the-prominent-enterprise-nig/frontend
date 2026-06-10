# TPE ClickUp Skills — Prompt Guide

Three slash commands for managing the TPE backlog from inside Claude Code.

---

## `/clickup-sync`

Pulls new tickets from ClickUp → updates local `backlog/` files → scans the codebase for implemented features → shows a batch summary before marking anything `for QA`.

### Best prompts

```
/clickup-sync
```

Full sync across all 14 modules. Pulls ClickUp, scans all controllers, shows you what it wants to mark `for QA`, waits for your confirm.

---

```
/clickup-sync HR
```

Scope to one module only. Faster. Good when you've just finished a module and want a quick status check without touching everything else.

---

```
/clickup-sync POS
```

Same pattern works for any prefix: `TEN`, `HR`, `FILES`, `RBAC`, `INV`, `POS`, `SO`, `ACC`, `PRO`, `CRM`, `QMS`, `PM`, `BI`, `SA`.

---

**What to expect:**

1. It fetches all ClickUp tasks and merges them into your local `backlog/<module>/tickets.md`.
2. It lists any new tickets from ClickUp that weren't in your local file.
3. It scans `src/` controllers and shows you a table of tickets it thinks are implemented.
4. You type `y` / `n` / `review one by one` before it touches anything in ClickUp.

---

## `/clickup-push`

Stages, commits, and pushes your current branch — then finds the matching ClickUp ticket and moves it to `in review`.

### Best prompts

```
/clickup-push
```

Auto-detect everything. It reads your branch name (e.g. `feat/SA-03-create-enterprise`) and extracts the ticket ID. Proposes a commit message from the diff. Asks you to confirm. Pushes and updates ClickUp.

---

```
/clickup-push SA-03
```

Skip auto-detection. Use this when your branch name doesn't contain the ticket ID or you're committing work for a specific ticket you already know.

---

```
/clickup-push
> Enter ticket ID: new
```

If it can't find a ticket and you respond `new`, it runs `/clickup-create-ticket` inline so you can create and link the ticket without leaving the flow.

---

```
/clickup-push
> Enter ticket ID: none
```

Push the code without touching ClickUp. Use for chore/infra commits that don't map to a user story.

---

```
/clickup-push --no-assign
```

Commit, push, and update ticket status — but skip the assignee update. Use when someone else owns the ticket and you're just contributing to it.

---

**What to expect:**

1. Shows you a `git diff --stat` summary.
2. Proposes a conventional commit message (`feat(module): description`).
3. Detects ticket from branch name → commit message → local `tickets.md` → asks you.
4. Commits, marks ticket `in review`, pushes.

---

## `/clickup-create-ticket`

Writes a full AA ISBAT ticket, saves it to `backlog/`, shows you a preview, and asks before pushing to ClickUp.

### Best prompts

```
/clickup-create-ticket HR: time-log CRUD for employees
```

Most efficient. Pass `<Module>: <feature description>` as the argument and it skips the questions.

---

```
/clickup-create-ticket SA: super admin can suspend a specific enterprise account
```

More descriptive → better ticket. The more context you give in the argument, the less it has to guess about the role, feature scope, and behavior.

---

```
/clickup-create-ticket POS: cashier refund flow with manager approval
```

Works for any module. Use the module prefix or full name — both work.

---

```
/clickup-create-ticket
```

No argument. It asks you four questions: module, feature description, user role, and whether it's already implemented. Use this when you're not sure about the module or want to think through the scope interactively.

---

```
/clickup-create-ticket POS: void transaction by manager --no-assign
```

Create the ticket without assigning it to you. Use when writing a ticket for someone else to pick up.

---

**What to expect:**

1. Reads existing `tickets.md` to auto-number the new ticket (e.g. `HR-51` if HR-50 exists).
2. Generates a full ticket: Given/When/Then, Buttons, Empty States, Post-Action Behavior, Figma Reference, FE subtask + BE subtask.
3. Shows you the full preview.
4. You type `y` (push to ClickUp), `e` (edit first), or `n` (save locally, push later).
5. If `y`, creates the task in ClickUp, assigns it to you, and writes the real URL back into your local file.

---

## Status Workflow Reference

```
TO DO → in progress → in review → for QA → failed QA → DONE
```

| Trigger                                        | Status set  |
| ---------------------------------------------- | ----------- |
| `/clickup-push`                                | `in review` |
| `/clickup-sync` (feature detected in code)     | `for QA`    |
| `/clickup-create-ticket` (already implemented) | `for QA`    |
| `/clickup-create-ticket` (not yet implemented) | `TO DO`     |
