---
name: pr-description
description: "Writes the PR title and description for BOTH repos (frontend + backend) from the real commits on a branch, whichever session or developer made them, filled into each repo's own .github PR template. Use when asked for a PR title/description/body, 'PR for FE and BE', or 'regardless the session'. Never posts, comments or opens a PR."
argument-hint: "Optional branch name, e.g. 'fix/business-owner-receive-own-dispatch'. Omit it to use the branch both checkouts are on, or the newest branch pushed to both repos."
---

# PR Description — TPE

You write the PR title and description for **both** repos. You describe **what is on the branch**, not what this session did. Never ask which session, which repo or which commits: derive them.

Repos: frontend `/Users/chloe/Documents/tpe-nig/frontend`, backend `/Users/chloe/Documents/tpe-nig/backend`. PRs target `development`.

## Steps

1. **Pick the branch.**
   - If an argument was given, use it.
   - Otherwise use the branch the checkouts are on. If a checkout is on `development` or `main`, run `git fetch` and list `git for-each-ref --sort=-committerdate --count=8 refs/remotes/origin` in each repo, and take the newest branch name that exists in **both**. If none exists in both, use the newest in each and say so.
   - State the branch you picked on the first line of your answer.

2. **Read the real commits in BOTH repos.** In each: `git fetch -q origin`, then
   - `git log --reverse --format='%h %an | %s' origin/development..origin/<branch>`
   - `git diff --stat origin/development...origin/<branch>`
   - `git show <sha>` for every commit (read the diff and the body, do not trust the subject).
     Cover **every** commit, whoever wrote it. One numbered item in the Description per commit, in plain words: what changed and why it matters. Never leave out another session's commit. If a repo has no commits on the branch, say "no changes in this repo" and skip its PR.
     Also run `git status --short` in both. Uncommitted work is not in the PR: mention it in one line, never commit it.

3. **Use each repo's real template.** Read `.github/PULL_REQUEST_TEMPLATE.md` in that repo (backend and frontend differ). Fill it in compact, paste-ready form: Description, References (ticket link stays blank unless you know it), Type of Change, Modules, Database Changes (backend), Security, Testing, Deployment. Skip empty boilerplate checklists, but keep every section a reviewer decides on.

4. **Be honest about checks.** Tick a box only if you ran it and saw it pass, in this session or in a hook output you can see. Say plainly what was NOT run (build, unit, e2e, manual testing) and why. Add a short "please check" list of what the reviewer should click through. Never write "tested" for something you only type-checked.

5. **Cross-repo facts.**
   - Migration present (`prisma/migrations/...` in the diff): say so, say it is data-only or schema, and that it applies on deploy.
   - If the frontend diff calls an endpoint the backend diff adds, say **"deploy the backend first"** in both PRs.
   - Flag anything UI-only that the backend does not enforce, and any change that exposes data across branches or roles, as a reviewer note.
   - Screenshots: say "to add" for UI changes; never invent a link.

6. **Output.** Start with one line: `Written for: the PR reviewers` plus the branch. Then **Backend** first, **Frontend** second. For each: the **Title** alone in a code block, then the **Description** in a ` `markdown ````block so it copies cleanly. Title format:`type(scope): summary` covering all commits, under about 120 characters. End with one line: the branch tips you verified and "nothing posted".

## Rules

- No attribution footer, no `Co-Authored-By`, no "Generated with" line.
- Never run `gh pr create`, `gh pr comment`, `gh pr review` or push anything. Writing the text is the whole job. The user posts it.
- Do not edit code, commit or switch branches. Read-only git only.
- Do not offer to build skills or extras. Answer what was asked.
