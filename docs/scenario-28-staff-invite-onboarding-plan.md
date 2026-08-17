# Scenario 28 — Staff Invite & Onboarding: Self-Service Account Setup for Customer Businesses — Gap Analysis & Closing Plan

Source: developer-initiated feature request, surfaced during a planning conversation with Claude, 2026-08-16 (not from either scenario source PDF, same as Scenarios 21-27) — prompted by realizing customers need to add their own staff once the app ships; only pre-seeded accounts exist today.

## The scenario we're building toward

Today, every login-capable account is created by `prisma/seed.ts` (dev/demo data) or manually by a super-admin, with no way for the invited person to actually set their own credentials. Once this ships to real customers, a Business Owner needs to add their own staff (Branch Managers, Cashiers, etc.) by email, and that person needs to set up their own password themselves — without the dev team touching the database.

Decisions made during the planning conversation, 2026-08-16:

- **Email + password, not Google/social login.** Weighed switching to or adding Google sign-in at length (the Philippines' Gmail-heavy market made this tempting) — rejected for now: Google-only would permanently lock out anyone without a matching Google account (a real risk for cashiers/shop-floor staff, including the common shared-family-Gmail case), and adding it _alongside_ password login isn't free either — it requires migrating login off the current Resource Owner Password Grant onto a real OAuth redirect flow first. Since Google is off the table, that migration is out of scope for this doc entirely.
- **Auth0 stays** as the identity provider — replacing it was considered and rejected: the current pain (M2M grant type misconfigured, see gap 3) is a fixable configuration issue, not an architectural flaw, and Auth0 keeps the door open for a future customer needing Microsoft/SSO without another rewrite.
- **One email = one account, globally** — not per-tenant. Matches the existing schema (`User.email` is `@unique`, not scoped by `enterpriseOwnerId`), so this was already the de facto rule; no schema change needed. A second tenant inviting an already-registered email is blocked outright, not silently allowed.
- **Invite expiry: 24 hours** — matches the existing `BusinessInvite` convention already used for the super-admin's tenant-first-admin invite (`INVITE_TTL_HOURS = 24`, `super-admin.service.ts:17`), not a separate window.
- **Seat/subscription limits are not enforced anywhere in the codebase today** (`userLimit` on `Subscription` is fetched for display only, never compared against a live count — confirmed by grep before building) — so Pending invites don't need special handling here; nothing to hook into.
- **A pending invite must not depend on email delivery actually working.** This surfaced live, not hypothetically: manual testing this same session hit a genuine Resend delivery failure (the configured domain, `tpe-nig.com`, has failed verification in Resend, and the account's sandbox sender only delivers to the Resend account's own registered email — see gap 4). Product decision: Copy Link becomes a first-class action, not an error-recovery afterthought — Closing Gap 1.
- **Pending invites get a dedicated "Pending Invites" sidebar section**, split out from Users — a not-yet-claimed invite isn't really "a user" (no `auth0Id`, no login capability), and a Business Owner shouldn't have to filter Users to find who hasn't set up yet. Mockup reviewed and approved in-conversation — Closing Gap 2.

## What's already done (real building blocks)

Nearly the entire core mechanic was built and tested in this same session — not starting from zero:

1. **`BusinessInvite`/`PasswordResetToken` models already existed** (`schema.prisma:68-78`, `1805-1817`) before this session, built for the super-admin's tenant-first-admin invite flow — token/expiresAt/usedAt shape reused as-is, no schema change needed anywhere in this scenario.
2. **`AuthService.claimInvite`/`validateInviteToken`** (`auth.service.ts:129-258`) already existed and are generic per-invite-record, not hardcoded to "first admin of a tenant" — reused unchanged for staff invites. `GET /auth/invite/:token` / `POST /auth/invite/:token/claim` (`auth.controller.ts:107-116`) and the frontend `/onboard` claim page already existed too.
3. **`UsersService.create()` now generates and sends the invite** (`users.service.ts:350-427`) — previously it just created a bare `User` row with no password path at all (defaulted to `status: ACTIVE` with no `auth0Id`, unusable). New shared helper `createAndSendInvite()` (`users.service.ts:303-348`) generates the token, creates/refreshes the `BusinessInvite` row, and emails it — reused by create, resend, and edit-email.
4. **Resilience to a failed email send, added after hitting the real Resend failure live**: `createAndSendInvite()` no longer lets a mailer exception fail the whole request — the user/invite rows are the durable state; a failed send returns `false` instead of throwing. `create()` (`users.service.ts:418-427`) surfaces this as `inviteEmailSent: boolean` on its response instead of a false "failed to create user"; `resendInvite`/`editPendingEmail` (`users.service.ts:430-452`, `466-500`) still throw a clear error, since sending the email is the entire point of those two actions.
5. **Resend/revoke/edit-email endpoints**: `POST /users/:id/resend-invite`, `POST /users/:id/revoke-invite`, `PATCH /users/:id/pending-email` (`users.controller.ts:170-234`), all gated `admin:users:update` like the rest of user management. `claimInvite` also now rejects a revoked invite (`auth.service.ts:172-173`, checks `invite.user.isActive === false`) — closes the gap where a revoked-but-unclaimed invite's old link would still work.
6. **Password policy hardened** — `ClaimInviteDto.password` had _no_ length/strength validation at all before this session; now requires 8+ chars with at least one letter and one number, matching `ChangePasswordDto`/`ConfirmResetPasswordDto` (`auth.controller.ts:35-38`, `change-password.dto.ts:11-14`, `confirm-reset-password.dto.ts:11-14`).
7. **`MailerService.sendUserInvite`** (`mailer.service.ts:121+`) — same branded-HTML pattern as the existing password-reset email, via the same Resend integration.
8. **Frontend fully wired**: `UserSchema` carries `status`/`businessInvites` (`schema/settings/list.ts`), shared `invite-status.ts` helper computes Pending/Expired/Active/Inactive, row menu + detail drawer show Resend/Edit Email/Revoke on a pending row, Users list has a Pending filter tab (stopgap, see gap 2), `CreateUserModal` copy says "Send Invite"/"Invite sent" and branches to a distinct "email failed" toast when `inviteEmailSent === false`.
9. **Tested**: `test/user-invite-flow.e2e-spec.ts`, 8/8 passing (invite persisted + emailed on create; duplicate blocked with a different message for active-vs-pending; resend regenerates the token in place; revoke permanently blocks the old link; expired token rejected; weak password rejected; full claim activates the user). Re-ran the pre-existing `users-list-owner-branch-scoping.e2e-spec.ts` — no regression.

## What's not done / gaps

1. **No way to get an invite link without querying the database directly.** Confirmed live this session: the invite email failed to send, and the only recovery was a raw `psql` query against `business_invites`. No UI surface shows the link at all today.
2. **Pending invites live inside the Users list** (filterable via the "Pending" tab added this session), not their own page — the agreed sidebar direction (mockup shown in-conversation) isn't built.
3. **Auth0's Management API isn't usable.** `Auth0ManagementService.getManagementToken()` (`auth0-management.service.ts:16-70`) falls back to the same `AUTH0_CLIENT_ID`/`AUTH0_CLIENT_SECRET` as normal login (no `AUTH0_MANAGEMENT_CLIENT_ID`/`_SECRET` set), and that application doesn't have the `client_credentials` grant type enabled — confirmed live via the actual Auth0 error (`Grant type 'client_credentials' not allowed for the client`). Real impact: every invite claim in this environment falls back to a dev-bypass token instead of creating a real Auth0 account, so a claimed user can't log back in through the normal login screen. **Not a code gap** — needs Auth0 dashboard access.
4. **Resend's sending domain isn't verified.** `tpe-nig.com`'s domain status is `"failed"` in the connected Resend account (confirmed live via the Resend API), so the app falls back to the sandbox sender `onboarding@resend.dev`, which Resend restricts to delivering only to that account's own registered email. **Not a code gap** — needs Resend dashboard access plus DNS control over a real domain (the team doesn't own one yet, per the planning conversation).

## Closing the gaps

### 1. Copy Link — make the invite link available without email working at all

**Problem**: right now, if the invite email doesn't arrive (proven to happen — see gap 4), there is no recovery path short of a direct database query.
**Fix**: surface the invite link directly in the product. Every Pending row (wherever it lives — Users' Pending filter today, the new dedicated page once gap 2 lands) gets a "Copy Link" action, always available, not gated behind an email failure. Backend needs the raw token added to whatever the Pending-row endpoint returns (`businessInvites[0]` is already included via `USER_SESSION_INCLUDE`/`findAll`, `users.service.ts`, but the token itself isn't in that select today) — scope this carefully since a token is a live credential: only ever return it to an already-permission-gated `admin:users:*` caller, never in a public/unauthenticated response. Frontend needs a copy-to-clipboard action (browser Clipboard API) and improved copy on the existing "Failed to resend invite" toast pointing at Copy Link instead of a dead end.

**Status**: not started.

### 2. Dedicated "Pending Invites" sidebar section

**Problem**: a not-yet-claimed invite isn't really "a user" (no `auth0Id`, can't log in) — commingling it with real Active/Inactive users in one filtered list makes it easy to miss and clutters the Users page's own filters.
**Fix**: new sidebar item under "My Workspace" (`SideBar.tsx`, next to `Users`), badge showing a live pending count. New page listing every `PENDING_SETUP` user with role/branch, invited-when, and status (Pending/Expiring soon/Expired), each row carrying Resend / Copy Link / Edit Email / Revoke. Users list drops its "Pending" filter tab again once this lands (added this session as a stopgap, not the final home) and shows only Active/Inactive. Reviewed and approved as a mockup in-conversation — see the published artifact from this planning session for the agreed layout/columns/actions.

**Status**: not started.

### 3. Get Auth0's Management API working (external, not code)

**Problem**: see gap 3 above — every claim currently produces a dev-bypass-only account, not a real one.
**Fix**: whoever owns this Auth0 tenant needs to (a) create a dedicated Machine-to-Machine application (don't reuse the login app's credentials — Auth0's own recommended practice), (b) authorize it for the Management API with `create:users`, `update:users`, `create:user_tickets`, (c) set `AUTH0_MANAGEMENT_CLIENT_ID`/`AUTH0_MANAGEMENT_CLIENT_SECRET` in `.env` — the code already checks for these first (`auth0-management.service.ts:22-26`), so no code change is needed once they're set. Verify via the existing e2e suite or a real claim, confirming the resulting `auth0Id` looks like a real Auth0 id, not falling back to dev-bypass.

**Status**: blocked on dashboard access outside this codebase — not an engineering task to pick up without that access first.

### 4. Get a working Resend sending domain (external, not code)

**Problem**: see gap 4 above — no invite email delivers to anyone except the Resend account's own registered address.
**Fix**: either finish verifying `tpe-nig.com`'s DNS records in the existing Resend account, or register a real domain and verify that instead (the team doesn't own one yet, per the planning conversation) — a product/ops decision, not an engineering one. Copy Link (gap 1) means this no longer blocks actually using the feature, just automated delivery.

**Status**: blocked on domain ownership/Resend dashboard access — Copy Link (gap 1) is the priority since it doesn't depend on this at all.

## Open Questions

1. ~~**Copy Link's exact placement**~~ — resolved 2026-08-16: dedicated icon-button per row, confirmed and built as mocked.
2. ~~**Live vs. refresh-on-load badge count**~~ — resolved 2026-08-16: refresh-on-navigation, confirmed and built (`useEffect` keyed on `pathname` in `SideBar.tsx`, no polling).
3. ~~**Token exposure surface**~~ — resolved 2026-08-16: kept behind a dedicated `admin:users:update`-gated endpoint (`GET /users/:id/invite-link`), deliberately never added to `findAll`/`findOne` (see the "worth flagging" note below on why).

## Implementation Log — 2026-08-16

**For this scenario, I have done:**

- **Closing Gap 1 (Copy Link)**: `UsersService.getInviteLink()` + `GET /users/:id/invite-link` (`users.service.ts`, `users.controller.ts`), gated `admin:users:update` like the rest of user management. Dedicated orange icon button on every pending row — both the Users-adjacent surfaces at the time and, after Part 2, the new Pending Invites page and its detail actions — disabled with an explanatory tooltip on an expired invite. Backend e2e: 3 new tests in `test/user-invite-flow.e2e-spec.ts` (now 14 total, all passing). Frontend e2e: `e2e/staff-invite-copy-link.spec.ts`, verified against a real browser + real (isolated) backend, including a real Resend rejection in that environment — confirmed Copy Link works regardless.
- **Closing Gap 2 (dedicated Pending Invites page)**: new `/settings/pending-invites` route (`PendingInvitesSection.tsx`), new sidebar item under "My Workspace" with a refresh-on-navigation red count badge (`getPendingInviteCount` action, re-fetched on every route change via `useEffect([pathname])` in `SideBar.tsx` — not polling). Backend: `GET /users` with no `status` param now excludes `PENDING_SETUP` by default (a not-yet-claimed invite isn't a real account yet); `status=PENDING` still surfaces them explicitly for the new page. `UsersSection.tsx`/`UserDetailDrawer.tsx` reverted back to Active/Inactive only — the Pending filter tab and pending-specific row/drawer actions built as Part 1's stopgap moved to the new page instead of staying duplicated. New backend e2e test confirming the default-exclude + explicit-include behavior. Frontend e2e: `e2e/pending-invites-page.spec.ts`.

**Worth flagging:**

- Closing Gaps 3 (Auth0 Management API) and 4 (Resend domain verification) remain untouched, exactly as scoped — both are external dashboard/DNS tasks, not engineering work.
- Found live while Playwright-testing Part 1/2 (not a code bug, and not the same issue as the dev environment's Resend account): the isolated e2e stack's Resend key rejects any `to` address on a domain like `example.com` outright ("Invalid `to` field... use our testing email address instead"), a _different_, stricter restriction than the dev Resend account's "only delivers to the account's own registered email" behavior documented earlier in this doc. Neither blocks anything — Copy Link exists specifically so email delivery never blocks onboarding — but worth knowing these are two distinct Resend-side restrictions, not one.
- `GET /users`/`GET /users/:id` still have no `PermissionsGuard`/`RequirePermissions` at all (surfaced while designing where Copy Link's token could safely live) — any authenticated user, any role, can currently list/view every user in their tenant. Real, live, unpatched — deliberately not fixed here since it's outside this scenario's scope; Copy Link's token was kept off these two responses specifically because of this gap, not despite it.
- `GET /users/:id/invite-link` audit-logs as `action: 'READ'` — the only read action logged in `UsersController` (everything else logged there is a mutation). Deliberate, given it exposes a live, usable credential, but worth a second look if audit-log volume/noise ever gets reviewed.
- The Pending Invites page skips a branch filter and search bar the mockup didn't show either — reasonable for now given the list is typically small, but if invite volume grows this may want parity with Users' filter/search row.
