---
name: implement-scenario
description: "Reads one scenario gap-analysis doc (frontend/docs/scenario-NN-*-plan.md), re-verifies it against current code, questions the developer on open decisions and scope, then implements the confirmed closing-gap items ONE PART AT A TIME — each part gets its own e2e tests and manual testing instructions, and the skill stops and waits for the developer to confirm each part before starting the next. Logs progress into the scenario doc, and — once confirmed done — fills in both repos' real PR templates ready to copy-paste and moves the matching ClickUp ticket(s) to 'in review'."
argument-hint: "Scenario number or slug, e.g. '05' or 'receiving' — resolves to frontend/docs/scenario-NN-*-plan.md"
---

# Implement Scenario — TPE

You implement one module-scenario gap-analysis plan end to end: re-verify it, question the developer on anything ambiguous, then build it **one part at a time** — test each part on both sides, hand the developer manual test steps for just that part, and stop until they confirm before starting the next. This is based on real precedent: a past scenario naturally split into 5+ parts across one implementation effort, and a developer using this skill shouldn't assume it all lands in one go. Once every confirmed part is done and verified, document it, hand back copy-paste-ready PRs, and move the matching ClickUp ticket(s) to "in review."

## Source docs

- Scenario plans: `frontend/docs/scenario-NN-<slug>-plan.md`
- Archive/index: `frontend/docs/module-scenarios.md`
- Seeded login accounts for manual testing: `frontend/docs/seed-data-reference.md`

## Role access hierarchy

Applies to every permission/role gate you add or touch, in every part. Hierarchy: **Business Owner > Branch Manager > Employee-level (Cashier, Stock Controller, etc.)**

- **Business Owner has access to everything, no exceptions.** If a part adds or touches an Employee-level capability (Cashier, Stock Controller, etc.), Business Owner must also hold it. Never write a permission check that excludes Business Owner from something a lower role can do.
- **A Branch-Manager-scoped capability is also available to Business Owner** — check this explicitly when writing the guard, don't assume it falls out automatically from the code.
- **A Branch-Manager-scoped capability is NOT automatically available to Employee-level roles.** This direction does not cascade down. Confirm with the developer in Phase 2 whether Cashier/Stock Controller need it too — don't assume either way.
- **An Employee-level capability IS automatically available to both Branch Manager and Business Owner** — cumulative upward (Employee ⊂ Branch Manager ⊂ Business Owner). This is also why this project's ClickUp backlog persona-splits tickets per role (see `frontend/docs/scenario-*` "Related ClickUp Tickets" sections) — those aren't duplicates, they're this same hierarchy tracked per role.

Apply this whenever Phase 3a adds a new permission string, RBAC guard, or role-gated UI element — and raise it explicitly in Phase 2 if a closing-gap item's target persona/scope isn't already clear from the doc.

---

## Procedure

### Phase 0 — Resolve the scenario

1. Take the argument passed to this skill (a number like `05`, or a slug fragment like `receiving`).
2. Glob `frontend/docs/scenario-*-plan.md` and match by number prefix or slug substring.
3. If no match or more than one match, list the candidates and ask the developer to pick — never guess.
4. Read the matched doc in full: the scenario recap, "What's already done ✅", "What's not done / gaps ❌⚠️", the ordered "Closing the gaps" list, and any "Dead code / unused-feature flags."

### Phase 1 — Read the code first (re-verify, don't trust the doc blindly)

The doc is a snapshot from whenever it was written — code moves.

1. For each claim in "What's already done" and "What's not done," spot-check the cited `file:line` evidence still holds. Use direct `Read`/`Grep` for small scenarios; use an `Explore` agent for scenarios with many citations.
2. If something has drifted — already fixed since the doc was written, reshaped, or moved — note it explicitly.
3. Summarize any drift found to the developer before Phase 2. Don't silently implement against a stale claim.

### Phase 2 — Question the developer

Do this before writing any code.

1. **Surface flagged decisions.** Scan the "Closing the gaps" section for language marking an open product/business decision (e.g. "confirm with the business," "this is a product decision, not a pure engineering one," "needs a decision," "define the actual... rule," "clarify with the business what this means"). Ask about each one explicitly — use `AskUserQuestion` where there are genuinely 2-4 concrete options, plain conversational questions otherwise. Do not pick a default and proceed. If an item adds or touches a role-gated capability, also apply the **Role access hierarchy** (above) — Business Owner is never optional; if the item is Branch-Manager-scoped, explicitly ask whether it should extend to Employee-level roles too, since that direction isn't automatic.
2. **Confirm scope.** List every item in "Closing the gaps" with a number and ask whether to implement all of them this run or a specific subset (several scenarios — e.g. Reservation, Caravan, Aircool — are large net-new features with many sequenced steps; doing everything in one pass may not be wanted). Also ask about "Dead code" flags if any apply — delete, wire up, or leave as-is.
3. **Confirm how the confirmed scope splits into parts.** Based on real precedent — a past scenario naturally split into 5+ parts across one implementation effort — **default to one part = one closing-gap item**, done one at a time, not batched. State that default plan back to the developer and let them regroup it (e.g. two trivially small items as one part) if they'd rather. Don't assume "scope approved" means "implement it all in one pass" — those are two different questions; Phase 3 runs as a loop over these parts regardless of how big the confirmed scope is.
4. **Confirm branch/commit posture.** Ask whether to work on the current branch or create a new one. Never commit without explicit go-ahead at commit time, even if the developer approved the overall plan — approval of scope is not approval to commit.
5. **Recap and confirm.** State back the confirmed item list, its part breakdown, and order before touching code. This is a lightweight go/no-go, not a full plan-mode detour — but don't skip it.

### Phase 3 — Implement, one part at a time

**This is a loop, not a batch.** For each part from Phase 2.3, in order, run 3a → 3b → 3c → 3d fully — including manual confirmation from the developer — before starting the next part's 3a. Never implement Part 2 while Part 1 is still unverified.

**3a. Implement this part**

1. Follow the pattern this item's "Fix" cites (e.g. "mirror the pattern already used for X at `file:line`") rather than inventing a new one.
2. Touch backend and/or frontend as this part requires.
3. No unrelated refactors, no premature abstraction, no creep into other parts' scope.
4. If this part adds or modifies a permission string, RBAC guard, or role-gated UI element, apply the **Role access hierarchy** (top of this doc) — Business Owner always included; Branch-Manager-scoped doesn't imply Employee-level access unless Phase 2 confirmed it should.

**3b. E2E tests for this part, both sides**

Backend, if this part has backend-observable behavior:

1. Add to or create `backend/test/<slug>.e2e-spec.ts`, following the existing pattern already used across `backend/test/*.e2e-spec.ts`: a real `INestApplication` via `Test.createTestingModule`, dev-bypass auth via a `signDevJwt(userId, extra)`-style HS256 token (see any existing spec for the exact helper), and a note at the top of the file on DB-seed prerequisites.
2. Run it individually — `npx jest --config test/jest-e2e.json --testPathPatterns <slug>` — not the full suite (shared fixtures contend across concurrently-running spec files, per this repo's own convention).
3. Fix failures before moving on. Never report a suite as passing when it isn't.

Frontend, if this part has a UI surface:

1. Add to or create `frontend/e2e/<slug>.spec.ts`, following the existing pattern in `frontend/e2e/*.spec.ts`: `gotoReady`/`fillStable`/`fillAllStable` helpers from `./utils` (they exist specifically to work around Next.js dev-mode hydration races — don't hand-roll waits instead), pre-authenticated via the `chromium` project's `storageState: 'e2e/.auth/business-owner.json'` (generated by `e2e/auth.setup.ts` — if a test needs a different role, check whether a matching storage state already exists before adding a new one), and self-cleaning (anything a test creates, it deletes at the end).
2. Run via `npm run test:e2e` (`playwright test` — config already runs single-worker against the existing dev server; don't spin up a second one).
3. Fix failures before moving on.

**3c. Manual testing instructions for this part only**

1. Look up applicable seeded accounts in `frontend/docs/seed-data-reference.md`.
2. Write numbered, concrete click-through steps for what _this part_ changed — same style already established in this project's docs: real account emails, real routes, real expected outcomes (not "verify it works," but "confirm the X column shows Y"). Don't preview steps for parts not yet built.

**3d. Report and stop — wait for confirmation before the next part**

Tell the developer directly, e.g.:

> "Part 2 of 5 done — <short name>. Here's how to manually test it: [steps from 3c]. Let me know once you've verified it (or found an issue) and I'll continue to Part 3."

- **Do not start the next part's 3a until the developer explicitly confirms.** This is a hard stop, not a suggestion.
- If they report a bug, fix it within the current part (repeat 3a-3c as needed) — never carry a known-broken part into the next one.
- If they instead say to keep going without testing each part, that's their call to make explicitly — don't assume it by default.

### Phase 4 — Update the scenario doc

Once every part in the confirmed scope from Phase 2 is implemented and manually confirmed, append — never overwrite the existing gap analysis above it:

```markdown
## Implementation Log — <YYYY-MM-DD>

**For this scenario, I have done:**

- <one line per part actually implemented and confirmed this run, referencing the item number from the doc>

**Worth flagging:**

- <deferred items, product decisions made and how, caveats introduced, follow-up needed>
```

One log entry per run covering all its parts together — not one entry per part. Multiple runs accumulate as additional dated entries, so the doc stays a living record instead of going stale the moment any part of it ships.

### Phase 5 — Ask "are you done?"

Once every confirmed part from Phase 3 is implemented, tested, and manually verified, and Phase 4's doc update is in, ask directly:

> "Are you done working on this scenario for now? Once you confirm, I'll generate copy-paste-ready PR titles and descriptions for backend and frontend."

- **Not done** → stop here. No PR text. Pick back up later (re-running this skill on the same scenario re-enters at Phase 1's re-verify step, so it correctly sees what's already implemented).
- **Done** → proceed to Phase 6.

### Phase 6 — Fill in the real PR templates

Backend and frontend are separate git repositories — produce two independent, copy-paste-ready blocks. **Never** run `gh pr create` or push — text output only.

1. Read `backend/.github/pull_request_template.md` and `frontend/.github/pull_request_template.md` fresh each run (don't hardcode their shape here — they can change).
2. Fill in each section from what actually happened this run, across all its parts:
   - **Description** — what this scenario's implemented parts do, in plain terms.
   - **Module(s) Affected** — check the real boxes.
   - **Type of Change** — check the real box(es).
   - **Database Changes** (backend template) — check "New migration included" if one was added, fill Migration notes.
   - **Security & Data Considerations** — answer honestly per part, don't blanket-check.
   - **Testing Verification** — reference the actual e2e spec file(s) added across Phase 3b's parts and confirm they pass; check `lint`/`type-check`/`build` boxes only if you actually ran them and they passed.
   - **Manual Testing Scenarios** — pull from each part's Phase 3c steps.
   - **Deployment Notes** — flag migrations/env vars/frontend-backend coordination honestly.
   - **Screenshots / Visuals** (frontend template) — leave a placeholder note for the developer to attach if the change touched UI; don't fabricate a description of a screenshot you can't take.
   - Leave **Reviewers Checklist** unchecked — that section is for the human reviewer, not you.
3. **Title** — follow this repo's existing commit convention shape, `<type>(<module>): <short description>` (see `clickup-push.md`'s convention in this same skills folder), under ~70 characters.
4. Present as two clearly labeled, separately copy-pasteable blocks: "Backend PR" and "Frontend PR." Cross-reference each other in the Description (e.g. "Companion frontend PR: <branch name>") since a scenario's work usually spans both.

### Phase 7 — Move the matching ClickUp ticket(s) to "in review"

Do this at the same time as Phase 6 — presenting the PR text is what triggers it.

1. From the scenario doc's `## Related ClickUp Tickets (Sprint 3-5)` section, identify the ticket(s) that correspond to the parts actually implemented and confirmed this run — not the whole list (some entries there cover deferred items, or are the intentional persona-split variants for a role you didn't touch this run).
2. For each matching ticket, call `clickup_update_task` with `status: "in review"` — same status string and mechanism `clickup-push.md` already uses in this same skills folder.
3. **Never downgrade a ticket.** If a ticket is already further along (`for qa`, `in review`, `done`, etc.), leave it — only move a ticket forward, exactly matching `clickup-push.md`'s own rule.
4. Update the ticket's line in the scenario doc's "Related ClickUp Tickets" section to reflect the new status (e.g. change `*Sprint 3, to do*` to `*Sprint 3, in review*`) so the doc doesn't silently go stale the moment you move something in ClickUp.
5. If an implemented part has no matching ticket at all (already called out under that scenario's "Not found in Sprint 3-5"), there's nothing to move — skip it silently, don't treat it as an error.
6. If ClickUp is unreachable or a ticket ID no longer resolves, report it to the developer rather than failing the whole phase silently — the PR text from Phase 6 still stands either way.

---

## Quality Checks

- [ ] Never trust the scenario doc's claims without spot-checking live code first (Phase 1)
- [ ] Never implement a flagged product/business decision without asking first (Phase 2)
- [ ] Never write a permission/role gate that excludes Business Owner from a capability a lower role has (Role access hierarchy)
- [ ] Never assume a Branch-Manager-scoped capability should extend to Employee-level roles without confirming in Phase 2 — that direction doesn't cascade automatically
- [ ] Never batch multiple parts' implementation together — one part's 3a-3d complete before the next part's 3a starts
- [ ] Never start the next part without the developer's explicit confirmation that the current part's manual test passed (Phase 3d) — assume "keep going without testing each part" is never the default, only something the developer opts into explicitly
- [ ] Never commit without explicit go-ahead, even after scope is approved
- [ ] Never report an e2e suite as passing if it isn't — fix failures, don't paper over them
- [ ] Never hand-roll waits in Playwright specs — use the existing `gotoReady`/`fillStable` helpers
- [ ] Never run backend e2e as a full-suite batch — run the new spec individually
- [ ] Never overwrite prior "Implementation Log" entries in the scenario doc — append only
- [ ] Never invent a PR body structure — always read the live `pull_request_template.md` files
- [ ] Never auto-create or push a PR — output copy-paste-ready text only
- [ ] Never skip the "are you done?" gate — PR text is generated only after explicit confirmation
- [ ] Never move a ClickUp ticket for a part that wasn't actually implemented and confirmed this run
- [ ] Never downgrade a ClickUp ticket's status when moving it to "in review"
- [ ] Never move the persona-split ticket variants for a role you didn't touch this run — they're intentional, not duplicates (see `frontend/docs/scenario-*` "Related ClickUp Tickets" sections for which ones are confirmed intentional vs. flagged for review)

## Tools Used

- `Read` / `Grep` (via Bash) — resolve the scenario doc, spot-check cited code
- `Agent` (Explore) — for larger re-verification passes across many citations
- `AskUserQuestion` — surface flagged decisions and confirm scope/branch posture
- `Edit` / `Write` — implement code changes, add e2e specs, update the scenario doc, no-op the PR templates into filled copies (output only, not committed as files)
- `Bash` — run `npx jest --config test/jest-e2e.json --testPathPatterns <slug>` and `npm run test:e2e`
- `clickup_update_task` — move the matching ticket(s) to "in review" once the PR text is handed back (Phase 9)
