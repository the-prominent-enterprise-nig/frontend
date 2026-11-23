---
name: pr-template
description: "Writes the PR title and description for BOTH repos (frontend + backend) from ONLY the commits THIS Claude session made, filled into each repo's own .github PR template. Use when asked for the PR of 'this session', 'just my commits here', 'only what we did in this chat'. For the whole branch whichever session made it, use pr-description instead. Never posts, comments or opens a PR."
argument-hint: "Optional branch name. Omit it to use the branch each checkout is on."
---

# PR Description (this session only) — TPE

You write the PR title and description for **both** repos, but you describe **only the commits this session made**. Commits from other sessions or developers that sit on the same branch are left out of the numbered list and mentioned in one line, so the reviewer is not surprised.

This is the narrow sibling of `pr-description`. That skill covers every commit on the branch; this one covers this session's commits.

Repos: frontend `/Users/chloe/Documents/tpe-nig/frontend`, backend `/Users/chloe/Documents/tpe-nig/backend`. PRs target `development`.

## Steps

1. **Find this session's commits (per repo).** Work from what this conversation did, in this order:
   1. **The conversation itself.** Every `git commit` this session ran printed `[<branch> <sha>] <subject>`. Collect those SHAs, per repo (commits made through a scratch worktree count too). This is the source of truth.
   2. **If the conversation no longer shows them** (context was compacted): take the session start time from the first `timestamp` in this session's transcript. The session id is the UUID in the scratchpad path (`.../<project>/<session-id>/scratchpad`), and the transcript is `~/.claude/projects/-Users-chloe-Documents-tpe-nig-backend/<session-id>.jsonl` (or the `...-frontend` project dir). Then in each repo run `git log --reverse --since=<start> --format='%h %cI | %s' origin/development..HEAD`.
      Those candidates may include a parallel session's commits, so say plainly "found by time window, not by record" and list each one so Chloe can strike any that are not hers.
   3. **If neither finds anything**: say "this session made no commits in this repo" and skip that repo. Do not fall back to the whole branch.
   - Verify every collected SHA is real and on the branch: `git branch -a --contains <sha>` and `git cat-file -t <sha>`.
   - State the branch and the SHA list per repo on the first lines of your answer.

2. **Read each commit.** `git show <sha>` for every SHA from step 1 (read the diff and the body, do not trust the subject). One numbered item in the Description per commit, in plain words: what changed and why it matters.
   Also compute the context line: `git log --format='%h %s' origin/development..HEAD` minus this session's SHAs. If other commits are on the branch, add one line: "The branch also holds N commits from other sessions (not described here): <short subjects>".
   Run `git status --short` in both repos. Uncommitted work is not in the PR: mention it in one line, never commit it.

3. **Already merged?** If a SHA is already in `origin/development` (`git merge-base --is-ancestor <sha> origin/development`), it is shipped. Say so and leave it out of the new PR. If every SHA is already there, say "nothing left to PR in this repo".

4. **Use each repo's real template.** Read `.github/PULL_REQUEST_TEMPLATE.md` in that repo (backend and frontend differ). Fill it in compact, paste-ready form: Description, References (ticket link stays blank unless you know it), Type of Change, Modules, Database Changes (backend), Security, Testing, Deployment. Skip empty boilerplate checklists, but keep every section a reviewer decides on.

5. **Be honest about checks.** Tick a box only if you ran it and saw it pass in this session. Say plainly what was NOT run (build, unit, e2e, manual testing) and why. Add a short "please check" list of what the reviewer should click through. Never write "tested" for something you only type-checked.

6. **Cross-repo facts.**
   - Migration among this session's commits (`prisma/migrations/...`): say so, say whether it is data-only or schema, and that it applies on deploy.
   - If this session's frontend commits call an endpoint this session's backend commits add, say **"deploy the backend first"** in both PRs.
   - If a frontend commit here depends on a backend commit from another session, say so as a reviewer note.
   - Flag anything UI-only that the backend does not enforce, and any change that exposes data across branches or roles.
   - Screenshots: say "to add" for UI changes; never invent a link.

7. **Output.** Start with one line: `Written for: the PR reviewers`, the branch, and "this session's commits only". Then **Backend** first, **Frontend** second. For each: the **Title** alone in a code block, then the **Description** in a ` ```markdown ` block so it copies cleanly. Title format: `type(scope): summary` covering this session's commits, under about 120 characters. End with one line: the SHAs you described, how you found them (conversation or time window), and "nothing posted".

## Rules

- No attribution footer, no `Co-Authored-By`, no "Generated with" line.
- Never run `gh pr create`, `gh pr comment`, `gh pr review` or push anything. Writing the text is the whole job. The user posts it.
- Do not edit code, commit or switch branches. Read-only git only.
- Never widen to the whole branch to be safe. If the user wants that, they use `pr-description`.
- Do not offer to build skills or extras. Answer what was asked.
